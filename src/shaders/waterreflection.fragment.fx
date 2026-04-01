precision highp float;

#define FOGMODE_NONE 0.
#define FOGMODE_EXP 1.
#define FOGMODE_EXP2 2.
#define FOGMODE_LINEAR 3.
#define E 2.71828

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec2 vUV;
varying vec2 vBumpUV;
varying vec2 vBumpUV2;
varying vec3 vReflectionMapTexCoord;
varying float fFogDistance;

uniform vec4 waterColor;
uniform float colorBlendFactor;
uniform vec4 waterColor2;
uniform float colorBlendFactor2;
uniform float bumpHeight;

uniform sampler2D reflectionSampler;
uniform sampler2D bumpSampler;

uniform vec4 vEyePosition;
uniform vec4 vDiffuseColor;
uniform vec4 vSpecularColor;

#include<__decl__lightFragment>[0..maxSimultaneousLights]
#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>

#include<helperFunctions>
#include<imageProcessingDeclaration>
#include<imageProcessingFunctions>
#include<fogFragmentDeclaration>

void main(void) {
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);
    
    vec4 baseColor = vec4(1., 1., 1., 1.);
    vec3 diffuseColor = vDiffuseColor.rgb;
    float alpha = vDiffuseColor.a;
    
    vec2 blendedUV = 0.6 * vBumpUV + 0.4 * vBumpUV2;
    vec4 bumpSample = texture2D(bumpSampler, blendedUV);
    
    vec2 bumpOffset = bumpSample.rg - 0.5;
    vec2 perturbation = bumpHeight * bumpOffset;
    vec2 clampedPerturbation = clamp(perturbation, -0.1, 0.1);
    
    vec3 normalW = normalize(vNormalW);
    
    vec3 bumpNormalW = normalize(normalW + vec3(clampedPerturbation.x * 8.0, 0.0, clampedPerturbation.y * 8.0));
    if (bumpNormalW.y < 0.0) {
        bumpNormalW.y = -bumpNormalW.y;
    }
    
    float invZ = 1.0 / max(vReflectionMapTexCoord.z, 0.01);
    vec2 baseTexCoords = vReflectionMapTexCoord.xy * invZ;
    
    vec2 projectedReflectionTexCoords = clamp(
        baseTexCoords + vec2(clampedPerturbation.x * 0.3, clampedPerturbation.y), 
        0.0, 1.0
    );
    
    vec4 reflectiveColor = texture2D(reflectionSampler, projectedReflectionTexCoords);
    
    float viewDotUp = dot(viewDirectionW, vec3(0.0, 1.0, 0.0));
    float fresnelTerm = clamp(abs(viewDotUp * viewDotUp * viewDotUp), 0.05, 0.65);
    float IfresnelTerm = 1.0 - fresnelTerm;
    
    reflectiveColor = IfresnelTerm*colorBlendFactor2*waterColor2 + (1.0-colorBlendFactor2*IfresnelTerm)*reflectiveColor;
    
    baseColor = reflectiveColor * IfresnelTerm + waterColor * fresnelTerm;
    
    vec3 diffuseBase = vec3(0., 0., 0.);
    lightingInfo info;
    float shadow = 1.;
    float glossiness = vSpecularColor.a;
    vec3 specularBase = vec3(0., 0., 0.);
    vec3 specularColor = vSpecularColor.rgb;
    
    #include<lightFragment>[0..maxSimultaneousLights]
    
    vec3 finalDiffuse = clamp(baseColor.rgb, 0.0, 1.0);
    vec3 finalSpecular = specularBase * specularColor;
    
    float viewAngleAlpha = 0.87 + (1.0 - fresnelTerm) * 0.1;
    viewAngleAlpha = clamp(viewAngleAlpha, 0.9, 1.0);
    
    vec4 color = vec4(finalDiffuse + finalSpecular, viewAngleAlpha);
    
    #include<fogFragment>
    
    #ifdef IMAGEPROCESSINGPOSTPROCESS
        color.rgb = toLinearSpace(color.rgb);
    #elif defined(IMAGEPROCESSING)
        color.rgb = toLinearSpace(color.rgb);
        color = applyImageProcessing(color);
    #endif
    
    gl_FragColor = color;
}