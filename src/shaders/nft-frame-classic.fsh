precision highp float;

// "Shiny" NFT image frame
uniform float time;
varying vec2 vUV;

const float PI = 3.14159265;
float t;

void main() {
    t = time / 9.0;

    vec2 uv = vUV * 200.0;
    float color1 = (sin(dot(uv.xy, vec2(sin(t*4.0), cos(t*4.0)))*0.02+t*4.0)+1.0)/2.0;
    vec2 center = vec2(640.0/2.0, 360.0/2.0) + vec2(640.0/2.0*sin(-t*3.0), 360.0/2.0*cos(-t*3.0));
    float color2 = (cos(length(uv.xy - center)*0.03)+1.0)/2.0;
    float color = (color1 + color2) / 2.0;

    float red = (cos(PI*color/0.5+t*3.0)+1.0)/2.0;
    float green = (sin(PI*color/0.5+t*3.0)+1.0)/2.0;
    float blue  = (sin(+t*3.0)+1.0)/2.0;

    float i = red + green + blue / 3.0;
    i -= 0.5;
    i = 1.0 - i;

    gl_FragColor = vec4(i * 0.9 + red * 0.1, i * 0.9 + green * 0.1, i * 0.9 + blue * 0.1, 1.);
}
