#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform float brightness;
uniform vec3  vLight;
uniform vec4  vFogInfos;
uniform vec3  vFogColor;

varying vec3  vPosEyeRel;
varying float vFogDistance;
varying vec3  colorValue;

#define FOGMODE_NONE 0.
#define FOGMODE_EXP 1.
#define FOGMODE_EXP2 2.
#define FOGMODE_LINEAR 3.

float CalcFogFactor()
{
 float fFogDistance = vFogDistance;
 float fogCoeff = 1.0;
 float fogStart = vFogInfos.y;
 float fogEnd = vFogInfos.z;
 float fogDensity = vFogInfos.w;

 if (FOGMODE_LINEAR == vFogInfos.x)
 {
  fogCoeff = (fogEnd - fFogDistance) / (fogEnd - fogStart);
 }
 else if (FOGMODE_EXP == vFogInfos.x)
 {
  fogCoeff = exp(-fFogDistance * fogDensity);
 }
 else if (FOGMODE_EXP2 == vFogInfos.x)
 {
  fogCoeff = exp(-fFogDistance * fFogDistance * fogDensity * fogDensity);
 }

 return clamp(fogCoeff, 0.0, 1.0);
}

void main() {
  // Compute geometric normal
  vec3 dp_dx = dFdx(vPosEyeRel);
  vec3 dp_dy = dFdy(vPosEyeRel);
  vec3 normal = -normalize(cross(dp_dx, dp_dy)); // invert normal, because we load our Vox models inside-out apparently.

  // Apply lighting
  float light = clamp(dot(normal, vLight) * 1.5 * brightness, 0.4 * brightness, 1.0);
  vec4 c = vec4(clamp(colorValue * light, 0.025, 1.0), 1.0);
  float fog = CalcFogFactor();
  c.xyz = fog * c.xyz + (1.0 - fog) * vFogColor;
  gl_FragColor = c;
  #include<imageProcessingCompatibility>
}