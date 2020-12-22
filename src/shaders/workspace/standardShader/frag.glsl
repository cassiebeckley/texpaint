#pragma glslify: tonemap = require(../../color/tonemap)

precision mediump float;

uniform vec3 uCameraPosition;

varying highp vec2 vTextureCoord;
varying highp vec3 vVertexNormal;
varying highp vec3 vWorldPosition;

uniform sampler2D uAlbedo;
uniform highp samplerCube uIrradiance; // TODO: replace irradiance map with spherical harmonics
uniform highp sampler2D uBrdfLUT;
uniform highp samplerCube uPrefilterMapLevel0; // TODO: see if this can be replaced with spherical harmonics
uniform highp samplerCube uPrefilterMapLevel1;
uniform highp samplerCube uPrefilterMapLevel2;
uniform highp samplerCube uPrefilterMapLevel3;
uniform highp samplerCube uPrefilterMapLevel4;

float metallic = 0.0;
float roughness = 0.5;
float ao = 1.0;

#define PI 3.1415926538

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) { // TODO: evaluate options for BRDF terms
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}

float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float num = a2;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    denom = PI * denom * denom;

    return num / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r*r) / 8.0;

    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return num / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

highp vec3 textureCubeSample(samplerCube cubemap, highp vec3 dir) {
    // sort of awkward attempt at smoothing float texture
    // TODO: this should all go once I switch to spherical harmonics
    float sampleDelta = 0.1;
    vec3 samples = vec3(0.0);

    float startAngle = -(sampleDelta * 2.0) / 2.0;

    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = cross(up, dir);
    up = cross(dir, right);

    for (int phiIter = 0; phiIter < 4; phiIter++) {
        float phi = float(phiIter) * sampleDelta + startAngle;
        for (int thetaIter = 0; thetaIter < 4; thetaIter++) {
            float theta = float(thetaIter) * sampleDelta + startAngle;

            vec3 tangentSample = vec3(sin(theta) * cos(theta), sin(theta) * sin(phi), cos(theta));
            vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * dir;

            samples += textureCube(cubemap, sampleVec).rgb;
        }
    }

    return samples * (1.0 / 16.0);
}

vec3 getPrefiltered(vec3 R, float roughness) {
    const float MAX_REFLECTION_LOD = 4.0;
    int level = int(floor(roughness * MAX_REFLECTION_LOD + 0.5));

    if (level == 0) return textureCube(uPrefilterMapLevel0, R).rgb;
    if (level == 1) return textureCube(uPrefilterMapLevel1, R).rgb;
    if (level == 2) return textureCube(uPrefilterMapLevel2, R).rgb;
    if (level == 3) return textureCube(uPrefilterMapLevel3, R).rgb;
    return textureCube(uPrefilterMapLevel4, R).rgb;
}

void main() {
    vec2 coord = vTextureCoord;
    coord.y = 1.0 - coord.y; // TODO: figure out if this should be done in the loader

    highp vec3 N = normalize(vVertexNormal);
    highp vec3 V = normalize(uCameraPosition - vWorldPosition);
    highp vec3 R = reflect(-V, N);

    highp vec3 irradiance = textureCubeSample(uIrradiance, N).rgb;
    // highp vec3 prefilteredColor = textureCubeLodEXT(uPrefilterMap, R, roughness * MAX_REFLECTION_LOD).rgb;
    highp vec3 prefilteredColor = getPrefiltered(R, roughness);
    vec3 albedo = texture2D(uAlbedo, coord).rgb;

    vec3 F0 = vec3(0.04); // TODO: probably calculate this from the IOR
    F0 = mix(F0, albedo, metallic);

    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);

    float brdf_x = max(dot(N, V), 0.0);
    float brdf_y = 1.0 - roughness;
    vec2 brdf = texture2D(uBrdfLUT, vec2(brdf_x, brdf_y)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;


    vec3 diffuse = irradiance * albedo;
    vec3 ambient = (kD * diffuse + specular) * ao;

    vec3 color = ambient;
    gl_FragColor.rgb = tonemap(color);
    gl_FragColor.a = 1.0;
}