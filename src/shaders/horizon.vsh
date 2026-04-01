precision highp float;

// Attributes
attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif

#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>

// Uniforms
#include<instancesDeclaration>

uniform mat4 view;
uniform mat4 viewProjection;

#ifdef POINTSIZE
uniform float pointSize;
#endif

// Output
varying vec3 vPositionW;
varying vec3 vPosition;

#include<clipPlaneVertexDeclaration>

#include<fogVertexDeclaration>

#define CUSTOM_VERTEX_DEFINITIONS

void main(void) {

    #define CUSTOM_VERTEX_MAIN_BEGIN

    #include<instancesVertex>

    vec4 worldPos = finalWorld * vec4(position, 1.0);

    gl_Position = viewProjection * worldPos;

    vPositionW = vec3(worldPos);
    vPosition = position;

    // Clip plane
    #include<clipPlaneVertex>

    // Fog
    #include<fogVertex>
    #include<shadowsVertex>[0..maxSimultaneousLights]


    #define CUSTOM_VERTEX_MAIN_END
}