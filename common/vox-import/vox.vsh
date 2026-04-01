attribute vec3 position;
attribute vec4 color;

#include<instancesDeclaration>
uniform mat4 worldViewProjection; // "The uniform worldViewProjection must be declared in the Vertex Shader as type mat4 and must be in the uniforms array."
uniform mat4 view;
uniform mat4 projection;
uniform vec3 cameraPosition;

varying vec3 vPosEyeRel;
varying float vFogDistance;
varying vec3 colorValue;

void main() {
  // Creates finalWorld var:
  #include<instancesVertex>

  colorValue = color.xyz;

  vec4 pos_ws = finalWorld * vec4(position, 1.0);
  // by using the relative position from camera pos to vertex pos, we get higher precision for normal calculations
  // so that voxes far away from the origin doesn't get weird shimmering artifacts
  vPosEyeRel = pos_ws.xyz - cameraPosition.xyz;

  // Apply equivalent of worldViewProjection matrix, but using finalWorld.
  gl_Position = projection * (view * pos_ws);

  vFogDistance = gl_Position.z; // Compute fog distance
}