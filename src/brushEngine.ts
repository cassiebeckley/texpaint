import { mat4, vec3 } from 'gl-matrix';
import { lerp } from './math';
import { generateRectVertices, rectVerticesUV } from './primitives';
import Slate from './slate';
import WindowManager from './windowManager';
import loadShaderProgram, { Shader } from './shaders';

import vertImageShader from 'url:./shaders/brush/2dShader/vert.glsl';
import fragImageShader from 'url:./shaders/brush/2dShader/frag.glsl';

export default class BrushEngine {
    gl: WebGLRenderingContext;

    radius: number;
    spacing: number;
    slate: Slate;

    segmentStart: vec3;
    segmentStartPressure: number;
    segmentSoFar: number;
    windowManager: WindowManager;

    stampVertices: number[];
    stampUVs: number[];

    brushShader: Shader;

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

        this.segmentStart = vec3.create();
        this.segmentStartPressure = 0;
        this.segmentSoFar = 0;

        this.stampVertices = [];
        this.stampUVs = [];

        this.brushShader = loadShaderProgram(
            this.gl,
            vertImageShader,
            fragImageShader
        );

        const gl = this.gl;

        this.framebuffer = gl.createFramebuffer();
    }

    startStroke(imageCoord: vec3, pressure: number) {
        vec3.copy(this.segmentStart, imageCoord);
        this.segmentStartPressure = pressure;
        this.segmentSoFar = 0;

        this.stampVertices = [];
        this.stampUVs = [];
    }

    continueStroke(imageCoord: vec3, pressure: number) {
        const displacement = vec3.create();
        vec3.sub(displacement, imageCoord, this.segmentStart);
        let segmentLength = vec3.len(displacement);
        const currentPoint = vec3.create();

        while (this.segmentSoFar <= segmentLength) {
            const t = this.segmentSoFar / segmentLength;
            vec3.scale(currentPoint, displacement, t);
            vec3.add(currentPoint, currentPoint, this.segmentStart);

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
        vec3.copy(this.segmentStart, imageCoord);

        this.slate.markUpdate();
    }

    finishStroke(imageCoord: vec3, pressure: number) {
        this.iteration(imageCoord, pressure);
        this.updateTextures();
        this.slate.apply();
    }

    private iteration(brushCenter: vec3, pressure: number) {
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

        const radiusSquare = vec3.create();
        vec3.set(radiusSquare, radius, radius, 0);

        const startPosition = vec3.clone(brushCenter);
        startPosition[1] = this.slate.height - startPosition[1];
        vec3.sub(startPosition, startPosition, radiusSquare);

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

        return radius;
    }

    getRadiusForStroke(radius: number, { pressure }) {
        const factor = pressure * pressure;
        return radius * factor;
    }

    updateTextures() {
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

        gl.useProgram(this.brushShader.program);

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
            this.brushShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.brushShader.uniforms.uModelViewMatrix,
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
                this.brushShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brushShader.attributes.aVertexPosition
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
                this.brushShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.brushShader.attributes.aTextureCoord
            );
        }

        {
            const offset = 0;
            const count = this.stampVertices.length / 2;
            gl.drawArrays(gl.TRIANGLES, offset, count);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.windowManager.restoreViewport();

        gl.deleteBuffer(vertexBuffer);
        gl.deleteBuffer(uvBuffer);

        this.stampVertices = [];
        this.stampUVs = [];
    }
}
