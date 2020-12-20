#pragma glslify: tonemap = require(../../color/tonemap)

precision mediump float;

uniform vec3 uCameraPosition;

varying highp vec2 vTextureCoord;
varying highp vec3 vVertexNormal;
varying highp vec3 vWorldPosition;

uniform sampler2D uAlbedo;
uniform samplerCube uIrradiance; // TODO: replace irradiance map with spherical harmonics

float metallic = 0.0;
float roughness = 0.5;
float ao = 1.0;

#define PI 3.1415926538

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) { // TODO: evaluate options for BRDF terms
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
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

vec3 textureCubeSample(samplerCube cubemap, vec3 dir) {
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

void main() {
    vec2 coord = vTextureCoord;
    coord.y = 1.0 - coord.y; // TODO: figure out if this should be done in the loader

    highp vec3 N = normalize(vVertexNormal);
    highp vec3 V = normalize(uCameraPosition - vWorldPosition);

    vec3 irradiance = textureCubeSample(uIrradiance, N).rgb;
    vec3 albedo = texture2D(uAlbedo, coord).rgb;

    gl_FragColor = vec4(irradiance, 1.0);
    return;

    vec3 F0 = vec3(0.04); // TODO: probably calculate this from the IOR

    vec3 lightPositions[4];
    lightPositions[0] = vec3(-10.0,  10.0, 10.0);
    lightPositions[1] = vec3( 10.0,  10.0, 10.0);
    lightPositions[2] = vec3(-10.0, -10.0, 10.0);
    lightPositions[3] = vec3( 10.0, -10.0, 10.0);
        

    vec3 lightColors[4];
    lightColors[0] = vec3(300.0, 300.0, 300.0);
    lightColors[1] = vec3(300.0, 300.0, 300.0);
    lightColors[2] = vec3(300.0, 300.0, 300.0);
    lightColors[3] = vec3(300.0, 300.0, 300.0);

    vec3 Lo = vec3(0.0, 0.0, 0.0);
    for (int i = 0; i < 4; i++) {
        vec3 L = normalize(lightPositions[i] - vWorldPosition);
        vec3 H = normalize(V + L); // halfway vector

        float distance = length(lightPositions[i] - vWorldPosition);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = lightColors[i] * attenuation;

        F0 = mix(F0, albedo, metallic);
        vec3 F = fresnelSchlickRoughness(max(dot(H, V), 0.0), F0, 0.0);

        float NDF = DistributionGGX(N, H, roughness);
        float G = GeometrySmith(N, V, L, roughness);

        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
        vec3 specular = numerator / max(denominator, 0.001);

        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;

        kD *= 1.0 - metallic;

        float NdotL = max(dot(N, L), 0.0); // TODO: some of these dot products are recalculated a lot, see if there's any optimization here
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }

    vec3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    vec3 kD = 1.0 - kS;
    vec3 diffuse = irradiance * albedo;
    vec3 ambient = (kD * diffuse) * ao;

    vec3 color = ambient; // + Lo;
    gl_FragColor.rgb = tonemap(color);
    gl_FragColor.a = 1.0;
}