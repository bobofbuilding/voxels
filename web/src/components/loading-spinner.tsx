export function LoadingSpinner(props: { version?: string }) {
  const bg = 'black'
  const fg = 'white'

  return (
    <div>
      <style>{`
        body,
        html {
          margin: 0;
          padding: 0;
          height: 100%;
        }

        .loading-spinner {
          width: 100%;
          height: 100%;
          position: absolute;
          z-index: 1000;
          background-color: ${bg};
          opacity: 0.8;
        }
      
        .loading-spinner .version {
          position: absolute;
          left: 50%;
          top: 50%;
          margin-top: 160px;
          margin-left: -50px;
          color: ${fg};
          text-align: center;
          width: 100px;
          font-size: 12px;
          font-family: sans-serif;
        }

        div.scene {
          transform-style: preserve-3d;
          animation: spin 2.2s infinite linear;
          position: relative;
        }
      
        @keyframes spin {
          0% {
            transform: rotateX(-20deg) rotateY(-20deg);
          }
      
          100% {
            transform: rotateX(-20deg) rotateY(-740deg);
          }
        }

        /* loading spinner */

         #tridiv{
            perspective:1200px;
            position:absolute;
            overflow:hidden;
            width:100%;
            height:100%;
            background:0 0;
            font-size: 64px;
        }
        .face{
            box-shadow:inset 0 0 0 1px ${fg};
        }
        .cr,.face,.face-wrapper,.scene,.shape{
            position:absolute;
            transform-style:preserve-3d
        }
        .scene{
            width:80em;
            height:80em;
            top:50%;
            left:50%;
            margin:-40em 0 0 -40em
        }
        .shape{
            top:50%;
            left:50%;
            width:0;
            height:0;
            transform-origin:50%
        }
        .face,.face-wrapper{
            overflow:hidden;
            transform-origin:0 0;
            backface-visibility:hidden
        }
        .face{
            background-size:100% 100%!important;
            background-position:center
        }
        .face-wrapper .face{
            left:100%;
            width:100%;
            height:100%
        }
        .photon-shader{
            position:absolute;
            left:0;
            top:0;
            width:100%;
            height:100%
        }
        .side{
            left:50%
        }
        .cr,.cr .side{
            height:100%
        }
        [class*=cuboid] .bk,[class*=cuboid] .ft{
            width:100%;
            height:100%
        }
        [class*=cuboid] .bk{
            left:100%
        }
        [class*=cuboid] .rt{
            transform:rotateY(-90deg) translateX(-50%)
        }
        [class*=cuboid] .lt{
            transform:rotateY(90deg) translateX(-50%)
        }
        [class*=cuboid] .tp{
            transform:rotateX(90deg) translateY(-50%)
        }
        [class*=cuboid] .bm{
            transform:rotateX(-90deg) translateY(-50%)
        }
        [class*=cuboid] .lt{
            left:100%
        }
        [class*=cuboid] .bm{
            top:100%
        }
        .bk{
            background-color:#ddd
        }
        .bm{
            background-color:#bdbdbd
        }
        .lt{
            background-color:#eee
        }
        .rt{
            background-color:#eee
        }
        .ft{
            transform:translateZ(.5em)
        }
        .bk{
            transform:translateZ(-.5em) rotateY(180deg)
        }
        .lt, .rt{
            width:1em;
            height:1em
        }
        .bm, .tp{
            width:1em;
            height:1em
        }
        .face{
            background-color:${bg};
        }

        .cub-1{
            transform:translate3D(-1em,-.5em,0) rotateX(0) rotateY(0) rotateZ(0);
            opacity:1;
            width:1em;
            height:1em;
            margin:-.5em 0 0 -.5em
        }
        .cub-2{
            transform:translate3D(-1em,.5em,0) rotateX(0) rotateY(0) rotateZ(0);
            opacity:1;
            width:1em;
            height:1em;
            margin:-.5em 0 0 -.5em;
        }
        .cub-3{
            transform:translate3D(0,1.5em,0) rotateX(0) rotateY(0) rotateZ(0);
            opacity:1;
            width:1em;
            height:1em;
            margin:-.5em 0 0 -.5em
        }
        .cub-4{
            transform:translate3D(1em,-0.5em,0) rotateX(0) rotateY(0) rotateZ(0);
            opacity:1;
            width:1em;
            height:1em;
            margin:-.5em 0 0 -.5em
        }
        .cub-5{
            transform:translate3D(1em,0.5em,0) rotateX(0) rotateY(0) rotateZ(0);
            opacity:1;
            width:1em;
            height:1em;
            margin:-.5em 0 0 -.5em
        }
      `}</style>

      <div>
        <div id="tridiv">
          <div style="-webkit-transform:rotateX(-8deg) rotateY(-2508deg); -moz-transform:rotateX(-8deg) rotateY(-2508deg); -ms-transform:rotateX(-8deg) rotateY(-2508deg); transform:rotateX(-8deg) rotateY(-2508deg); ">
            <div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>

        {!!props.version && <div>v{props.version}</div>}
      </div>
    </div>
  )
}
