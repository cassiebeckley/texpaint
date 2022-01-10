#version 300 es
#pragma glslify: tonemap = require(../../color/tonemap)

precision mediump float;

uniform vec3 uCameraPosition;

in highp vec2 vTextureCoord;
in highp vec3 vVertexNormal;
in highp vec3 vWorldPosition;

out vec4 finalColor;

uniform sampler2D uAlbedo;
uniform sampler2D uMetallic;
uniform sampler2D uRoughness;

uniform highp samplerCube uIrradiance; // TODO: replace irradiance map with spherical harmonics
uniform highp sampler2D uBrdfLUT;
uniform highp samplerCube uPrefilterMapLevel0; // TODO: see if this can be replaced with spherical harmonics
uniform highp samplerCube uPrefilterMapLevel1;
uniform highp samplerCube uPrefilterMapLevel2;
uniform highp samplerCube uPrefilterMapLevel3;
uniform highp samplerCube uPrefilterMapLevel4;

uniform mat4 uBackgroundMatrix;

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

vec3 getPrefiltered(vec3 R, float roughness) {
    const float MAX_REFLECTION_LOD = 4.0;
    float level = roughness * MAX_REFLECTION_LOD;
    float t = fract(level);

    // TODO: try doing a linear filter between levels for gradient falloff of roughness

    vec3 a;
    vec3 b;

    if (level < 1.0) {
        a = texture(uPrefilterMapLevel0, R).rgb;
        b = texture(uPrefilterMapLevel1, R).rgb;
    } else if (level < 2.0) {
        a = texture(uPrefilterMapLevel1, R).rgb;
        b = texture(uPrefilterMapLevel2, R).rgb;
    } else if (level < 3.0) {
        a = texture(uPrefilterMapLevel2, R).rgb;
        b = texture(uPrefilterMapLevel3, R).rgb;
    } else {
        a = texture(uPrefilterMapLevel3, R).rgb;
        b = texture(uPrefilterMapLevel4, R).rgb;
    }

    return mix(a, b, t);
}

void main() {
    vec2 coord = vTextureCoord;
    coord.y = 1.0 - coord.y; // TODO: figure out if this should be done in the loader

    highp vec3 N = normalize(vVertexNormal);
    highp vec3 V = normalize(uCameraPosition - vWorldPosition);
    highp vec3 R = reflect(-V, N);

    vec3 albedo = texture(uAlbedo, coord).rgb;
    float roughness = texture(uRoughness, coord).x;
    float metallic = texture(uMetallic, coord).x;

    highp vec3 irradiance = texture(uIrradiance, (uBackgroundMatrix * vec4(N, 1.0)).xyz).rgb;
    highp vec3 prefilteredColor = getPrefiltered((uBackgroundMatrix * vec4(R, 1.0)).xyz, roughness);

    vec3 F0 = vec3(0.04); // TODO: probably calculate this from the IOR
    F0 = mix(F0, albedo, metallic);

    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);

    float brdf_x = max(dot(N, V), 0.0);
    float brdf_y = 1.0 - roughness;
    vec2 brdf = texture(uBrdfLUT, vec2(brdf_x, brdf_y)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;


    vec3 diffuse = irradiance * albedo;
    vec3 ambient = (kD * diffuse + specular) * ao;

    vec3 color = ambient;
    finalColor.rgb = tonemap(color);
    finalColor.a = 1.0;
}