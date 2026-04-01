// original from https://github.com/BabylonJS/Babylon.js/tree/8ea7b5b285751022605d6e4e66a32e922c5b2674/materialsLibrary/src/water
precision highp float;

// Attributes
attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif

#include<bonesDeclaration>

// Uniforms
#include<instancesDeclaration>

uniform mat4 view;
uniform mat4 viewProjection;

#ifdef BUMP
varying vec2 vNormalUV;
#ifdef BUMPSUPERIMPOSE
    varying vec2 vNormalUV2;
#endif
uniform mat4 normalMatrix;
uniform vec2 vNormalInfos;
#endif

#ifdef POINTSIZE
uniform float pointSize;
#endif

// Output
varying vec3 vPositionW;
#ifdef NORMAL
varying vec3 vNormalW;
#endif

#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif

#include<clipPlaneVertexDeclaration>

#include<fogVertexDeclaration>
#include<__decl__lightFragment>[0..maxSimultaneousLights]

#include<logDepthDeclaration>

// Water uniforms
uniform mat4 worldReflectionViewProjection;
uniform float windHeading;
uniform float waveLength;
uniform float time;
uniform float windForce;
uniform float waveHeight;
uniform float waveSpeed;
uniform float waveCount;

// Water varyings
varying vec3 vPosition;
varying vec3 vRefractionMapTexCoord;
varying vec3 vReflectionMapTexCoord;

// http://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch01.html
vec3 gerstnerWave(vec3 vertPos, float length, float height, float steepness, float speed, vec2 dir, float t) {
	if (height < 0.0000001) {
		return vec3(0,0,0);
	}
	float W = 2.0 / length;
	float Q = steepness / (W * height);
	float inner = dot(vec2(vertPos.x, vertPos.z), dir) * W + (t * W * speed);
	vec3 result;
	result.x = Q * height * dir.x * cos(inner);
	result.y = height * sin(inner);
	result.z = Q * height * dir.y * cos(inner);
	return result;
}

// remaps 'value' that has lies between 'min1' and 'max1' to a value between 'min2' and 'max2'
float map(float value, float min1, float max1, float min2, float max2) {
	return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

// use two sine waves and time to generate something that can be mistaken for randomness :P
// https://www.desmos.com/calculator/ziy8az1bbm
// @todo: unoptimised
vec2 semiRand(float heading, float oscSpeed, float range) {
	float xh = (1.0 - time * oscSpeed);
	float aPart = 0.5 * sin(xh/1.0);
	float qPart = 0.3 * sin(xh/0.4);
	// we want sine values to be usable in the call to mix so remap to it's 0 - 1 range
	float gradient = map(aPart + qPart, -1., 1., 0., 1.);
	float halfRange = range * 0.5;
	float direction = mix(heading - halfRange, heading + halfRange, gradient);
	float radians = direction * 3.141592;
	return vec2(sin(radians), cos(radians));
}

void main(void) {

    #include<instancesVertex>
    #include<bonesVertex>

	vec4 worldPos = finalWorld * vec4(position, 1.0);
	vPositionW = vec3(worldPos);

#ifdef NORMAL
	vNormalW = normalize(vec3(finalWorld * vec4(normal, 0.0)));
#endif

	// Texture coordinates
#ifndef UV1
	vec2 uv = vec2(0., 0.);
#endif
#ifndef UV2
	vec2 uv2 = vec2(0., 0.);
#endif

vec2 windDirection = vec2(sin(windHeading), cos(windHeading));

#ifdef BUMP
	if (vNormalInfos.x == 0.)
	{
		vNormalUV = vec2(normalMatrix * vec4((uv * 1.0) / waveLength + time * windForce * windDirection, 1.0, 0.0));
        #ifdef BUMPSUPERIMPOSE
		    vNormalUV2 = vec2(normalMatrix * vec4((uv * 0.721) / waveLength + time * 1.2 * windForce * windDirection, 1.0, 0.0));
		#endif
	}
	else
	{
		vNormalUV = vec2(normalMatrix * vec4((uv2 * 1.0) / waveLength + time * windForce * windDirection , 1.0, 0.0));
        #ifdef BUMPSUPERIMPOSE
    		vNormalUV2 = vec2(normalMatrix * vec4((uv2 * 0.721) / waveLength + time * 1.2 * windForce * windDirection , 1.0, 0.0));
    	#endif
	}
#endif

	// Clip plane
	#include<clipPlaneVertex>

	// Fog
    #include<fogVertex>

	// Shadows
    #include<shadowsVertex>[0..maxSimultaneousLights]

	// Vertex color
#ifdef VERTEXCOLOR
	vColor = color;
#endif

	// Point size
#ifdef POINTSIZE
	gl_PointSize = pointSize;
#endif

	vec3 p = position;
	// @todo using vPositionW only instead if so that if the mesh is moving with the camera the waves doesnt move, this only
	// looks okay as long as the mesh have a resonable high resolution
	p += gerstnerWave(vPositionW, waveLength, waveHeight, 0.1, waveSpeed, semiRand(windHeading, 1.0, 0.2), time);
	p += gerstnerWave(vPositionW, waveLength*0.34, waveHeight/2.21, 0.0, waveSpeed*1.942, semiRand(windHeading+.15, 0.24, 0.3), time);
	p += gerstnerWave(vPositionW, waveLength*1.4, waveHeight*0.332, 0.0, waveSpeed*.543, semiRand(windHeading-.26, 0.32, 0.4), time);
	p += gerstnerWave(vPositionW, waveLength*.2, waveHeight*0.123, 0.2, waveSpeed*2.32, semiRand(windHeading-1.0, 0.35, 0.5), time);
	gl_Position = viewProjection * finalWorld * vec4(p, 1.0);

#ifdef REFLECTION
	worldPos = viewProjection * finalWorld * vec4(p, 1.0);

	// Water
	vPosition = position;

	vRefractionMapTexCoord.x = 0.5 * (worldPos.w + worldPos.x);
	vRefractionMapTexCoord.y = 0.5 * (worldPos.w + worldPos.y);
	vRefractionMapTexCoord.z = worldPos.w;

	worldPos = worldReflectionViewProjection * vec4(position, 1.0);
	vReflectionMapTexCoord.x = 0.5 * (worldPos.w + worldPos.x);
	vReflectionMapTexCoord.y = 0.5 * (worldPos.w + worldPos.y);
	vReflectionMapTexCoord.z = worldPos.w;
#endif

#include<logDepthVertex>

}