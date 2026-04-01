attribute vec3 position;
attribute vec3 normal;
attribute float block;
attribute float ambientOcclusion;

uniform mat4 worldViewProjection;
uniform float tileCount;
uniform vec3 palette[16];

varying vec3  vNormal;
varying float vFogDistance;
varying vec2  vTileCoord;
varying vec2  vTexCoord;
varying float vAmbientOcclusion;
varying vec3 vColorValue;

void main() {
    // Compute fog distance
    vFogDistance = (worldViewProjection * vec4(position, 1.0)).z;

    // incoming ambientOcclusion is byte value, transform to 0.0 - 1.0
    vAmbientOcclusion = ambientOcclusion / 255.0;

    //Compute normal
    vNormal = normal;

    //Compute texture coordinate
    vTexCoord = vec2(dot(position * 2.0, vec3(normal.y-normal.z, 0, normal.x)),
    dot(position * 2.0, vec3(0, -abs(normal.x+normal.z), normal.y)));

    float textureIndex = mod(float(block), 32.0);

    int colorIndex = int(mod(floor(float(block) / 32.0), 8.0));

    vColorValue = palette[colorIndex];

    //Compute tile coordinate
    float tx    = textureIndex / tileCount;
    vTileCoord.y = floor(tx);
    vTileCoord.x = fract(tx) * tileCount;

    gl_Position = worldViewProjection * vec4(position, 1.0);
}
