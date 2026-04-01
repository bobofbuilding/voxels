precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

#include<instancesDeclaration>
#include<fogVertexDeclaration>

uniform mat4 view;
uniform mat4 viewProjection;

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec2 vUV;

void main(void) {
    #include<instancesVertex>

    vec4 worldPos = finalWorld * vec4(position, 1.0);
    vPositionW = vec3(worldPos);
    vNormalW = normalize(mat3(finalWorld) * normal);
    vUV = uv;

    gl_Position = viewProjection * worldPos;

     #include<fogVertex>
}