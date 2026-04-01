precision highp float;

// "Plasma" NFT image frame
uniform float time;
varying vec2 vUV;

void main() {
    float n = sin(time * 4.0 + (vUV.x + vUV.y) * 4.0);
    float b = abs(n);
    float rg = abs(b*b*b*b*b*b);

    float n2 = sin(-time * 5.0 + (vUV.x - vUV.y) * 3.0);
    float b2 = abs(n2);
    float rg2 = abs(b2*b2*b2*b2*b2*b2);

    gl_FragColor = vec4(rg * rg2, rg * rg2, (b + b2) * 0.5, 1.0);
}
