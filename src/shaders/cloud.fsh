precision highp float;

// Varying
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUV;

// Uniforms
uniform mat4 world;
uniform float time;
uniform float alpha;

const float PI = 3.14159265358979323846264338327950288;

// used to normalise the output from sin and cos between 0.0 and 1.0
float normalise(float value) {
    return (value + 1.0) / 2.0;
}

float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }

float noise(vec3 x) {
    const vec3 step = vec3(110, 241, 171);

    vec3 i = floor(x);
    vec3 f = fract(x);

    // For performance, compute the base input to a 1D hash from the integer part of the argument and the
    // incremental change to the 1D based on the 3D -> 1D wrapping
    float n = dot(i, step);

    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
    mix(hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
    mix(mix(hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
    mix(hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

#define NUM_OCTAVES 5
#define SCALE 0.5

float fbm(in vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100);
    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main(void) {

    // changes how fast the waves move
    float u_time = time * 2.0;

    vec3 st = vPosition * SCALE;
    vec3 color = vec3(0.0);

    vec3 q = vec3(0.);
    q.x = fbm(st + 0.00*u_time);
    q.y = fbm(st + vec3(1.0));

    vec3 r = vec3(0.);
    r.x = fbm(st + 1.0*q + vec3(1.7, 9.2, 2.3)+ 0.15*u_time);
    r.y = fbm(st + 1.0*q + vec3(8.3, 2.8, 5.3)+ 0.126*u_time);
    r.z = fbm(st + 1.0*q + vec3(3.2, 5.7, 1.2)+ 0.08*u_time);

    float f = fbm(st+r);

    color = mix(vec3(0.61, 0.10, 0.66), vec3(0.66, 0.49, 0.66), clamp((f*f)*4.0, 0.0, 1.0));

    color = mix(color, vec3(0.164706, 0, 0.164706), clamp(length(q), 0.0, 1.0));

    color = mix(color, vec3(1, 0.666667, 1), clamp(length(r.x), 0.0, 1.0));

    color = (f*f*f+.6*f*f+.5*f)*color;

    float lum = color.r * 0.3749999531 + color.g * 0.25 + color.b * 0.3749999531;
    lum = smoothstep(0.0, 0.1, lum);

    // make it sligtly brighter purple
    color = mix(color, vec3(0.5, 0.0, 1.0), 0.1);

    gl_FragColor = vec4(color, lum * alpha);

    #include<imageProcessingCompatibility>
}