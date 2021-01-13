import { mat4, vec2, vec3 } from 'gl-matrix';
import { lerp } from './math';
import { generateRectVertices, rectVerticesUV } from './primitives';
import Slate from './slate';
import WindowManager from './windowManager';
import ShaderSource, { Shader } from './shaders';

import vertBrush2dShader from './shaders/brush/2d.shader/vert.glsl';
import fragBrush2dShader from './shaders/brush/2d.shader/frag.glsl';

import vertBrush3dShader from './shaders/brush/3d.shader/vert.glsl';
import fragBrush3dShader from './shaders/brush/3d.shader/frag.glsl';

export default class BrushEngine {
    gl: WebGLRenderingContext;

    radius: number;
    spacing: number;
    slate: Slate;

    segmentStart: vec2;
    segmentStartPressure: number;
    segmentSoFar: number;
    windowManager: WindowManager;

    stampVertices: number[];
    stampUVs: number[];
    stampRadius: number[];

    stamp3d: { center: vec3; radius: number }[];

    brush2dShader: Shader;
    brush3dShader: Shader;

    private framebuffer: WebGLFramebuffer;

    constructor(
        diameter: number,
        spacing: number,
        windowManager: WindowManager
    ) {
        this.gl = windowManager.gl;

        const radius = diameter / 2;
        this.radius = radius;
        this.spacing = spacing;

        this.windowManager = windowManager;
        this.slate = windowManager.slate;

        this.segmentStart = vec2.create();
        this.segmentStartPressure = 0;
        this.segmentSoFar = 0;

        this.stampVertices = [];
        this.stampUVs = [];
        this.stampRadius = [];
        this.stamp3d = [];

        const brush2dSource = new ShaderSource(
            'brush2d',
            vertBrush2dShader,
            fragBrush2dShader
        );
        this.brush2dShader = brush2dSource.load(this.gl);

        const brush3dSource = new ShaderSource(
            'brush3d',
            vertBrush3dShader,
            fragBrush3dShader
        );
        this.brush3dShader = brush3dSource.load(this.gl);

        const gl = this.gl;

        this.framebuffer = gl.createFramebuffer();
    }

    startStroke(imageCoord: vec2, pressure: number) {
        vec2.copy(this.segmentStart, imageCoord);
        this.segmentStartPressure = pressure;
        this.segmentSoFar = 0;

        this.stampVertices = [];
        this.stampUVs = [];
        this.stampRadius = [];
    }

    continueStroke(imageCoord: vec2, pressure: number) {
        const displacement = vec2.create();
        vec2.sub(displacement, imageCoord, this.segmentStart);
        let segmentLength = vec2.len(displacement);
        const currentPoint = vec2.create();

        while (this.segmentSoFar <= segmentLength) {
            const t = this.segmentSoFar / segmentLength;
            vec2.scale(currentPoint, displacement, t);
            vec2.add(currentPoint, currentPoint, this.segmentStart);

            const currentPressure = lerp(
                this.segmentStartPressure,
                pressure,
                t
            );

            const radius = this.iteration(currentPoint, currentPressure);

            let nextSpacing = this.spacing * radius;
            if (nextSpacing < 1) {
                nextSpacing = 1;
            }
            this.segmentSoFar += nextSpacing;
        }

        this.segmentSoFar -= segmentLength;
        if (segmentLength < 0) {
            segmentLength = 0;
        }

        this.segmentStartPressure = pressure;
        vec2.copy(this.segmentStart, imageCoord);

        this.slate.markUpdate();
    }

    finishStroke(imageCoord: vec2, pressure: number) {
        this.iteration(imageCoord, pressure);
        this.updateTextures();
        this.slate.apply();
    }

    startStroke3D(brushCenter: vec3, pressure: number) {
        this.stamp3d = [];
    }

    continueStroke3D(brushCenter: vec3, pressure: number) {
        // TODO: use same spacing approach as 2d
        this.iteration3d(brushCenter, pressure);
        this.updateTextures3D();
        this.slate.markUpdate();
    }

    finishStroke3D(brushCenter: vec3, pressure: number) {
        this.iteration3d(brushCenter, pressure);
        this.updateTextures3D();
        this.slate.apply();
    }

    private iteration(brushCenter: vec2, pressure: number) {
        // a single dot of the brush

        const radius = this.getRadiusForStroke(this.radius, { pressure });

        if (
            brushCenter[0] <= -radius ||
            brushCenter[0] >= this.slate.width + radius ||
            brushCenter[1] <= -radius ||
            brushCenter[1] >= this.slate.height + radius
        ) {
            // entirely outside image bounds
            return radius;
        }

        const radiusSquare = vec2.create();
        vec2.set(radiusSquare, radius, radius);

        const startPosition = vec2.clone(brushCenter);
        startPosition[1] = this.slate.height - startPosition[1];
        vec2.sub(startPosition, startPosition, radiusSquare);

        const side = radius * 2;

        const geo = generateRectVertices(
            startPosition[0],
            startPosition[1],
            side,
            side
        );
        for (let i = 0; i < geo.length; i++) {
            this.stampVertices.push(geo[i]);
            this.stampUVs.push(rectVerticesUV[i]);
        }
        for (let i = 0; i < geo.length / 2; i++) {
            this.stampRadius.push(radius);
        }

        return radius;
    }

    private iteration3d(brushCenter: vec3, pressure: number) {
        // a single dot of the brush

        const radius = this.getRadiusForStroke(this.radius, { pressure });

        this.stamp3d.push({ center: brushCenter, radius });

        return radius;
    }

    getRadiusForStroke(radius: number, { pressure }) {
        const factor = pressure * pressure;
        return radius * factor;
    }

    private updateTextures2D() {
        if (this.stampVertices.length === 0) {
            return;
        }

        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.slate.currentOperation,
            0
        );
        gl.viewport(0, 0, this.slate.width, this.slate.height);
        gl.scissor(0, 0, this.slate.width, this.slate.height);

        gl.useProgram(this.brush2dShader.program);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(this.stampVertices),
            gl.STATIC_DRAW
        );

        const uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(this.stampUVs),
            gl.STATIC_DRAW
        );

        const radiusBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(this.stampRadius),
            gl.STATIC_DRAW
        );

        // set projection and model*view matrices;

        const projectionMatrix = mat4.create();
        mat4.ortho(
            projectionMatrix,
            0,
            this.slate.width,
            this.slate.height,
            0,
            -1,
            1
        );
        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.brush2dShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.brush2dShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.vertexAttribPointer(
                this.brush2dShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brush2dShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            gl.vertexAttribPointer(
                this.brush2dShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brush2dShader.attributes.aTextureCoord
            );
        }

        {
            const size = 1;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
            gl.vertexAttribPointer(
                this.brush2dShader.attributes.aBrushRadius,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brush2dShader.attributes.aBrushRadius
            );
        }

        {
            const offset = 0;
            const count = this.stampVertices.length / 2;
            gl.drawArrays(gl.TRIANGLES, offset, count);
        }

        gl.disableVertexAttribArray(this.brush2dShader.attributes.aBrushRadius);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.windowManager.restoreViewport();

        gl.deleteBuffer(vertexBuffer);
        gl.deleteBuffer(uvBuffer);
        gl.deleteBuffer(radiusBuffer);

        this.stampVertices = [];
        this.stampUVs = [];
        this.stampRadius = [];
    }

    private updateTextures3D() {
        if (!this.windowManager.mesh || this.stamp3d.length === 0) {
            return;
        }

        // TODO: cover seams properly
        // TODO: maybe solve this by adding extra geometry at seams in a pre-process step when the mesh is loaded?

        const gl = this.gl;
        gl.disable(gl.CULL_FACE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.slate.currentOperation,
            0
        );
        gl.viewport(0, 0, this.slate.width, this.slate.height);
        gl.scissor(0, 0, this.slate.width, this.slate.height);

        gl.useProgram(this.brush3dShader.program);

        // set projection and model*view matrices;

        const projectionMatrix = mat4.create();
        mat4.ortho(
            projectionMatrix,
            0,
            this.slate.width,
            this.slate.height,
            0,
            -1,
            1
        );
        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);

        gl.uniformMatrix4fv(
            this.brush3dShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.brush3dShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        gl.uniform1i(
            this.brush3dShader.uniforms.uTextureWidth,
            this.slate.width
        );
        gl.uniform1i(
            this.brush3dShader.uniforms.uTextureHeight,
            this.slate.height
        );

        {
            const size = 3;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(
                gl.ARRAY_BUFFER,
                this.windowManager.mesh.vertexBuffer
            );
            gl.vertexAttribPointer(
                this.brush3dShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brush3dShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.windowManager.mesh.uvBuffer);
            gl.vertexAttribPointer(
                this.brush3dShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brush3dShader.attributes.aTextureCoord
            );
        }

        gl.bindBuffer(
            gl.ELEMENT_ARRAY_BUFFER,
            this.windowManager.mesh.indexBuffer
        );

        for (let i = 0; i < this.stamp3d.length; i++) {
            const stamp = this.stamp3d[i];

            gl.uniform3fv(this.brush3dShader.uniforms.uCenter, stamp.center);
            gl.uniform1f(
                this.brush3dShader.uniforms.uRadius,
                stamp.radius / 500
            );

            gl.drawElements(
                gl.TRIANGLES,
                this.windowManager.mesh.data.triangles.length * 3,
                gl.UNSIGNED_SHORT,
                0
            );
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.windowManager.restoreViewport();
        gl.enable(gl.CULL_FACE);

        this.stamp3d = [];
    }

    updateTextures() {
        this.updateTextures2D();
        this.updateTextures3D();
    }
}
