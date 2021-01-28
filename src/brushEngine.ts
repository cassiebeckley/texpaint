import { mat4, vec2, vec3 } from 'gl-matrix';
import { lerp } from './math';
import { generateRectVertices, rectVerticesUV } from './primitives';
import MaterialSlate from './materialSlate';
import WindowManager from './windowManager';
import ShaderSource, { Shader } from './shaders';

import vertBrush2dShader from './shaders/brush/2d.shader/vert.glsl';
import fragBrush2dShader from './shaders/brush/2d.shader/frag.glsl';

import vertBrush3dShader from './shaders/brush/3d.shader/vert.glsl';
import fragBrush3dShader from './shaders/brush/3d.shader/frag.glsl';
import Mesh from './mesh';
import type Scene from './scene';

class Spacer {
    spacing: number;

    lastCoord: vec2;
    lastPressure: number;
    soFar: number;

    constructor(spacing: number, start: vec2, pressure: number) {
        this.spacing = spacing;

        this.lastCoord = vec2.clone(start);
        this.lastPressure = pressure;
        this.soFar = 0;
    }

    // TODO: basic smoothing
    segmentTo(
        coord: vec2,
        pressure: number,
        iteration: (center: vec2, pressure: number) => number
    ) {
        const displacement = vec2.create();
        vec2.sub(displacement, coord, this.lastCoord);
        let length = vec2.len(displacement);
        const currentPoint = vec2.create();

        while (this.soFar <= length) {
            const t = this.soFar / length;
            vec2.scale(currentPoint, displacement, t);
            vec2.add(currentPoint, currentPoint, this.lastCoord);

            const currentPressure = lerp(this.lastPressure, pressure, t);

            const radius = iteration(currentPoint, currentPressure);

            let nextSpacing = this.spacing * radius;
            if (nextSpacing < 1) {
                nextSpacing = 1;
            }
            this.soFar += nextSpacing;
        }

        this.soFar -= length;

        this.lastPressure = pressure;
        vec2.copy(this.lastCoord, coord);
    }
}

export default class BrushEngine {
    gl: WebGLRenderingContext;

    radius: number;
    spacing: number;
    soft: boolean;

    spacer: Spacer;
    spacer3d: Spacer;
    windowManager: WindowManager;
    scene: Scene;

    stampVertices: number[];
    stampUVs: number[];
    stampRadius: number[];

    stamp3d: { center: vec3; radius: number }[];

    brush2dShader: Shader;
    brush3dShader: Shader;

    private currentSlate: MaterialSlate;

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
        this.soft = false;

        this.windowManager = windowManager;
        this.scene = windowManager.scene;

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

        this.currentSlate = null;

        const gl = this.gl;
        this.framebuffer = gl.createFramebuffer();
    }

    startStroke(imageCoord: vec2, pressure: number) {
        this.spacer = new Spacer(this.spacing, imageCoord, pressure);

        this.stampVertices = [];
        this.stampUVs = [];
        this.stampRadius = [];
    }

    continueStroke(slate: MaterialSlate, imageCoord: vec2, pressure: number) {
        if (this.spacer) {
            this.spacer.segmentTo(imageCoord, pressure, (coord, pressure) =>
                this.iteration(slate, coord, pressure)
            );

            this.currentSlate = slate;
            slate.markUpdate();
        }
    }

    finishStroke(slate: MaterialSlate, imageCoord: vec2, pressure: number) {
        this.spacer = null;

        this.iteration(slate, imageCoord, pressure);
        this.updateTextures2D(slate);
        slate.apply();
    }

    startStroke3D(uiCoord: vec2, pressure: number) {
        this.spacer3d = new Spacer(this.spacing, uiCoord, pressure); // TODO: handle spacing for 3d correctly
        this.stamp3d = [];
    }

    continueStroke3D(
        uiCoord: vec2,
        pressure: number,
        getCoord: (uiCoord: vec2) => vec3
    ) {
        if (this.spacer3d) {
            this.spacer3d.segmentTo(uiCoord, pressure, (coord, pressure) => {
                const brushCenter = getCoord(coord);
                if (brushCenter) {
                    return this.iteration3d(brushCenter, pressure);
                }

                return this.getRadiusForStroke({ pressure });
            });

            for (let [_, slate] of this.scene.materials) {
                slate.markUpdate();
            }
        }
    }

    finishStroke3D(
        uiCoord: vec2,
        pressure: number,
        getCoord: (uiCoord: vec2) => vec3
    ) {
        this.spacer3d = null;

        const brushCenter = getCoord(uiCoord);
        if (brushCenter) {
            this.iteration3d(brushCenter, pressure);
        }

        for (let i = 0; i < this.scene.meshes.length; i++) {
            const slate = this.updateTextures3D(this.scene.meshes[i]);
            if (!slate) continue;
            slate.apply();
        }
    }

    private iteration(
        slate: MaterialSlate,
        brushCenter: vec2,
        pressure: number
    ) {
        // a single dot of the brush

        const radius = this.getRadiusForStroke({ pressure });

        if (
            brushCenter[0] <= -radius ||
            brushCenter[0] >= slate.size + radius ||
            brushCenter[1] <= -radius ||
            brushCenter[1] >= slate.size + radius
        ) {
            // entirely outside image bounds
            return radius;
        }

        const radiusSquare = vec2.create();
        vec2.set(radiusSquare, radius, radius);

        const startPosition = vec2.clone(brushCenter);
        startPosition[1] = slate.size - startPosition[1];
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

        const radius = this.getRadiusForStroke({ pressure });

        this.stamp3d.push({ center: brushCenter, radius });

        return radius;
    }

    getRadiusForStroke({ pressure }) {
        const factor = pressure * pressure;
        return this.radius * factor;
    }

    private updateTextures2D(slate: MaterialSlate) {
        if (this.stampVertices.length === 0) {
            return;
        }

        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            slate.currentOperation,
            0
        );
        gl.viewport(0, 0, slate.size, slate.size);
        gl.scissor(0, 0, slate.size, slate.size);

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
        mat4.ortho(projectionMatrix, 0, slate.size, slate.size, 0, -1, 1);
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

        gl.uniform1i(this.brush2dShader.uniforms.uSoft, Number(this.soft));

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

    private updateTextures3D(mesh: Mesh) {
        if (!mesh || this.stamp3d.length === 0) {
            return;
        }

        const slate = this.scene.materials.get(mesh.data.materialId);

        // TODO: cover seams properly
        // TODO: maybe solve this by adding extra geometry at seams in a pre-process step when the mesh is loaded?
        // TODO: or maybe they can be covered by drawing geometry as lines after triangles?

        const gl = this.gl;
        gl.disable(gl.CULL_FACE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            slate.currentOperation,
            0
        );
        gl.viewport(0, 0, slate.size, slate.size);
        gl.scissor(0, 0, slate.size, slate.size);

        gl.useProgram(this.brush3dShader.program);

        // set projection and model*view matrices;

        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, slate.size, slate.size, 0, -1, 1);
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

        gl.uniform1i(this.brush3dShader.uniforms.uTextureWidth, slate.size);
        gl.uniform1i(this.brush3dShader.uniforms.uTextureHeight, slate.size);

        gl.uniform1i(this.brush3dShader.uniforms.uSoft, Number(this.soft));

        {
            const size = 3;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
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
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
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

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

        for (let i = 0; i < this.stamp3d.length; i++) {
            const stamp = this.stamp3d[i];

            gl.uniform3fv(this.brush3dShader.uniforms.uCenter, stamp.center);
            gl.uniform1f(
                this.brush3dShader.uniforms.uRadius,
                stamp.radius / 500
            );

            gl.drawElements(
                gl.TRIANGLES,
                mesh.data.triangles.length * 3,
                gl.UNSIGNED_SHORT,
                0
            );
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.windowManager.restoreViewport();
        gl.enable(gl.CULL_FACE);

        this.stamp3d = [];

        return slate;
    }

    updateTextures() {
        if (this.currentSlate) {
            this.updateTextures2D(this.currentSlate);
            this.currentSlate = null;
        }

        for (let i = 0; i < this.scene.meshes.length; i++) {
            this.updateTextures3D(this.scene.meshes[i]);
        }
    }
}
