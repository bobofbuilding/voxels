precision highp float;

uniform float tileSize;
uniform sampler2D tileMap;
uniform sampler2D lightMap;
uniform float tileCount;
uniform float brightness;
uniform vec3 lightDirection;
uniform vec3 fogColor;
uniform float fogDensity;

varying vec3 vNormal;
varying vec2 vTileCoord;
varying vec2 vTexCoord;
varying vec2 vUV2;
varying vec3 vColorValue;
varying float vFogDistance;

#include<helperFunctions>

float CalcFogFactor()
{
    float fogCoeff = exp(-vFogDistance * vFogDistance * fogDensity * fogDensity);
    return clamp(fogCoeff, 0.0, 1.0);
}

float pow16(float x)
{
    float x2 = x*x;
    float x4 = x2*x2;
    float x8 = x4*x4;
    return x8*x8;
}

void main() {

    vec2 uv      = vTexCoord;
    vec4 color   = vec4(0, 0, 0, 0);
    float weight = 0.0;

    vec2 tileOffset = 2.0 * tileSize * vTileCoord;
    float denom     = 2.0 * tileSize * tileCount;

    for (int dx=0; dx<2; ++dx) {
        for (int dy=0; dy<2; ++dy) {
            vec2 offset = 2.0 * fract(0.5 * (uv + vec2(dx, dy)));
            float w = pow16(1.0 - max(abs(offset.x-1.0), abs(offset.y-1.0)));

            vec2 tc = (tileOffset + tileSize * offset) / denom;
            color  += w * texture2D(tileMap, tc);
            weight += w;
        }
    }
    color /= weight;

    if (color.w < 0.5) {
        discard;
    }

    color.xyz *= vColorValue;
    color = clamp(color, 0.025, 1.0);

    // we are sampling one level higher mipmap (-1.0) to minimize "bleed over" from outside the ligtmap texture
    // sampling that can cause a tint on things at an angle and far away.
    // We now use compressed lightmap textures, and setting invertY = false when creating a BABYLON.Texture from them has
    // no effect on ShaderMaterials, so we need to flip the V coord here in the shader.
    //  vec4 lm = texture2D(lightMap, vUV2, -1.0);
    vec4 lm = texture2D(lightMap, vec2(vUV2.x, 1.0 - vUV2.y), -1.0);
    vec4 c = vec4(lm.xyz * color.xyz, 1.0);
    // float light = clamp(dot(vNormal, lightDirection) * 1.5 * brightness, 0.4 * brightness, 1.0);
    float light = clamp(dot(vNormal, lightDirection) * 0.1 + 0.8, 0.8, 1.0);

    float fog = CalcFogFactor();
    c.xyz = mix(fogColor, c.xyz, fog);

    gl_FragColor = c * light;
    #include<imageProcessingCompatibility>
}
