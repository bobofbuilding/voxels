precision highp float;

// "Lava Lamp" NFT image frame
uniform float time;
varying vec2 vUV;

void main() {
    gl_FragColor = vec4(sin(time), sin((time + vUV.x) * 2.0), sin((time + vUV.y) * 1.3), 1.0);
}
