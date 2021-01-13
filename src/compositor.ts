import vertCompositeShader from 'url:./shaders/composite.shader/vert.glsl';
import fragCompositeShader from 'url:./shaders/composite.shader/frag.glsl';
import { getUnitRectPositionBuffer, getUnitRectUVBuffer } from './primitives';
import ShaderSource, { Shader } from './shaders';
import WindowManager from './windowManager';
import { mat4 } from 'gl-matrix';

enum CompositeMode {
    Normal = 0,
    Mask = 1,
}

type Operand = WebGLTexture | OperationBuilder;

type Operation = {
    mode: CompositeMode;
    operand: Operand;
};

export function O(input: Operand) {
    return new OperationBuilder(input);
}

class OperationBuilder {
    input: WebGLTexture;
    operations: Operation[];

    constructor(input: WebGLTexture) {
        this.input = input;

        this.operations = [];
    }

    mix(operand: Operand) {
        this.operations.push({ mode: CompositeMode.Normal, operand });
        return this;
    }

    mask(operand: Operand) {
        this.operations.push({ mode: CompositeMode.Mask, operand });
        return this;
    }
}

export default class Compositor {
    private windowManager: WindowManager;
    private gl: WebGLRenderingContext;
    private width: number;
    private height: number;

    private framebuffer: WebGLFramebuffer;

    private compositeShader: Shader;

    constructor(wm: WindowManager, width: number, height: number) {
        this.windowManager = wm;
        this.gl = wm.gl;
        this.width = width;
        this.height = height;

        const gl = wm.gl;

        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const compositeSource = new ShaderSource(
            'composite',
            vertCompositeShader,
            fragCompositeShader
        );
        this.compositeShader = compositeSource.load(gl);
    }

    setDimensions(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    run(output: WebGLTexture, builder: OperationBuilder) {
        const gl = this.gl;

        let tempTextures = [];
        let tempTexture = () => {
            const t = gl.createTexture();
            tempTextures.push(t);
            return t;
        };

        const operations = builder.operations;
        let composited = builder.input;

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            let operand: WebGLTexture;
            if (op.operand instanceof OperationBuilder) {
                operand = createLayerTexture(gl, this.width, this.height);

                this.run(operand, op.operand);
            } else {
                operand = op.operand;
            }

            let outputBuffer: WebGLTexture;

            if (i === operations.length - 1) {
                outputBuffer = output;
            } else {
                outputBuffer = tempTexture();
            }

            this.composite(outputBuffer, operand, composited, op.mode);

            composited = outputBuffer;
        }

        for (let i = 0; i < tempTextures.length; i++) {
            gl.deleteTexture(tempTextures[i]);
        }
    }

    private composite(
        output: WebGLTexture,
        a: WebGLTexture,
        b: WebGLTexture,
        mode: CompositeMode
    ) {
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            output,
            0
        );
        gl.viewport(0, 0, this.width, this.height);
        gl.scissor(0, 0, this.width, this.height);

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        //// draw 2d image view ////
        gl.useProgram(this.compositeShader.program);

        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, this.width, this.height, 0, -1, 1);
        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);
        mat4.scale(modelViewMatrix, modelViewMatrix, [
            this.width,
            this.height,
            1,
        ]);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.compositeShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.compositeShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectPositionBuffer(gl));
            gl.vertexAttribPointer(
                this.compositeShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.compositeShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectUVBuffer(gl));
            gl.vertexAttribPointer(
                this.compositeShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.compositeShader.attributes.aTextureCoord
            );
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, a);
        gl.uniform1i(this.compositeShader.uniforms.uTextureA, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, b);
        gl.uniform1i(this.compositeShader.uniforms.uTextureB, 1);

        gl.uniform1i(this.compositeShader.uniforms.uMode, mode);

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.windowManager.restoreViewport();
    }
}

export function createLayerTexture(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    fill?: Uint8ClampedArray
) {
    const texture = gl.createTexture();

    fillTexture(gl, texture, width, height, fill);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
}

export function fillTexture(
    gl: WebGLRenderingContext,
    texture: WebGLTexture,
    width: number,
    height: number,
    fill?: Uint8ClampedArray
) {
    const buffer = new Uint8ClampedArray(width * height * 4);

    if (fill) {
        buffer.fill(255);
        for (let i = 0; i < buffer.length; i += 4) {
            buffer[i + 0] = fill[0];
            buffer[i + 1] = fill[1];
            buffer[i + 2] = fill[2];
            buffer[i + 3] = fill[3];
        }
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const format = gl.RGBA;
    const border = 0;
    const type = gl.UNSIGNED_BYTE;

    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        buffer
    );
}
