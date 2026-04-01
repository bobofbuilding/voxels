precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

#include<instancesDeclaration>
#include<fogVertexDeclaration>

uniform mat4 view;
uniform mat4 viewProjection;
uniform mat4 worldReflectionViewProjection;
uniform vec4 vEyePosition;
uniform float windHeading;
uniform float windForce;
uniform float waveLength;
uniform float time;
uniform mat4 normalMatrix;

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec2 vUV;
varying vec2 vBumpUV;
varying vec2 vBumpUV2;
varying vec3 vReflectionMapTexCoord;

void main(void) {
    #include<instancesVertex>

    vec4 worldPos = finalWorld * vec4(position, 1.0);
    vPositionW = vec3(worldPos);
    vNormalW = normalize(mat3(finalWorld) * normal);
    vUV = uv;

    vec2 windDirection = vec2(sin(windHeading), cos(windHeading));
    vBumpUV = vec2(normalMatrix * vec4((uv * 1.0) / waveLength + time * windForce * windDirection, 1.0, 0.0));
    vBumpUV2 = vec2(normalMatrix * vec4((uv * 0.721) / waveLength + time * 1.2 * windForce * windDirection, 1.0, 0.0));

    gl_Position = viewProjection * worldPos;

    vec4 reflectionScreenPos = worldReflectionViewProjection * worldPos;
    vReflectionMapTexCoord.x = 0.5 * (reflectionScreenPos.w + reflectionScreenPos.x);
    vReflectionMapTexCoord.y = 0.5 * (reflectionScreenPos.w + reflectionScreenPos.y);
    vReflectionMapTexCoord.z = reflectionScreenPos.w;

    #include<fogVertex>
}