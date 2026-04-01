precision highp float;

uniform float tileSize;
uniform sampler2D tileMap;
uniform float tileCount;

uniform float brightness;
uniform float ambient;
uniform vec3  lightDirection;
uniform vec3  fogColor;
uniform float fogDensity;
uniform float alpha;

varying vec3  vNormal;
varying vec2  vTileCoord;
varying vec2  vTexCoord;
varying float vAmbientOcclusion;
varying float vFogDistance;
varying vec3  vColorValue;

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

#include<helperFunctions>

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

    // NOTE: Palette is applied twice (here and in line 64) for backward compatibility.
    // This creates a squared palette effect (color * palette^2) that has been part
    // of the visual style for years. Removing it would change how all existing parcels look.
    color.xyz *= vColorValue;

    float light = clamp(dot(vNormal, lightDirection) * 1.5 * brightness, 0.4 * brightness, 1.0);
    vec4 c = vec4(clamp(color.xyz * vColorValue * light, 0.025, 1.0) * vAmbientOcclusion, alpha);
    float fog = CalcFogFactor();
    c.xyz = fog * c.xyz + (1.0 - fog) * fogColor;

    gl_FragColor = c;

    #include<imageProcessingCompatibility>
}
  