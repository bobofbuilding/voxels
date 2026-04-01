attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv2;
attribute vec4 color;
attribute float block;

uniform float tileCount;
uniform mat4 worldViewProjection;
uniform vec3 palette[16];

varying vec3 vNormal;
varying vec2 vTileCoord;
varying vec2 vTexCoord;
varying vec3 vColorValue;
varying vec2 vUV2;
varying float vFogDistance;

void main() {
    //Pass normal  and UV to fragments
    vNormal = normal;
    vUV2 = uv2;

    // Compute fog distance
    vFogDistance = (worldViewProjection * vec4(position, 1.0)).z;

    //Compute texture coordinate
    vTexCoord = vec2(dot(position * 2.0, vec3(normal.y-normal.z, 0, normal.x)),
    dot(position * 2.0, vec3(0, -abs(normal.x+normal.z), normal.y)));

    //Compute color value
    int colorIndex = int(mod(floor(block / 32.0), 8.0));
    vColorValue = palette[colorIndex];

    //Compute tile coordinate
    float textureIndex = mod(block, 32.0);
    float tx    = textureIndex / tileCount;
    vTileCoord.y = floor(tx);
    vTileCoord.x = fract(tx) * tileCount;

    // Result...
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
