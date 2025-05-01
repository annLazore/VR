'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let surfaceWebCam;              // A substrate for webcam image
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = -1;

let video;

let videoTexture = null;
let webcamElement = null;
let bgProgram = null;   // our background-video shader program



// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program || null;
    this.iAttribVertex       = -1;
    this.iColor              = -1;
    this.iModelViewMatrix    = -1;
    this.iProjectionMatrix   = -1;
    this.iUseTexture         = -1;
    this.iSampler            = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


ShaderProgram.prototype.init = function(gl, vertexSrc, fragmentSrc) {
    // Збірка вертексного шейдера
    const vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vertexSrc);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Vertex shader compile error: " + gl.getShaderInfoLog(vsh));
    }
    // Збірка фрагментного шейдера
    const fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fragmentSrc);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Fragment shader compile error: " + gl.getShaderInfoLog(fsh));
    }
    // Лінкування програми
    const prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
};


// === A. Ініціалізація шейдерів для фонового квадра з відео ===
function initBackgroundShaders() {
    const vs = `
        attribute vec2 position;
        attribute vec2 texCoord;
        varying vec2 vTexCoord;
        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
            vTexCoord = texCoord;
        }
    `;
    const fs = `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        void main() {
            gl_FragColor = texture2D(uTexture, vTexCoord);
        }
    `;
    
  // 1) Створюємо й компілюємо програму
    bgProgram = new ShaderProgram("Background");
    bgProgram.init(gl, vs, fs);
    bgProgram.Use();  // щоб getAttribLocation/getUniformLocation працювали коректно

    // 2) Витягуємо локації
    bgProgram.positionLoc = gl.getAttribLocation(bgProgram.prog, "position");
    bgProgram.texCoordLoc = gl.getAttribLocation(bgProgram.prog, "texCoord");
    bgProgram.textureLoc  = gl.getUniformLocation(bgProgram.prog,  "uTexture");
}

// === B. Функція, що малює фон відео ===
function drawVideoBackground() {
    const bp = bgProgram;
    gl.useProgram(bp.prog);

    
    const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
    ]);
    // texCoord з одночасним горизонтальним+вертикальним перевертанням
    const texCoords = new Float32Array([
        1, 1,  0, 1,
        1, 0,  0, 0
    ]);

    // Вершинний буфер
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(bp.positionLoc);
    gl.vertexAttribPointer(bp.positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Буфер текстурних координат
    const tbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tbo);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(bp.texCoordLoc);
    gl.vertexAttribPointer(bp.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Завантажуємо відеокадр у текстуру
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        gl.RGBA, gl.UNSIGNED_BYTE,
        webcamElement
    );
    gl.uniform1i(bp.textureLoc, 0);

    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Прибираємо тимчасові буфери
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(tbo);

    // Повертаємося до основної програми
    gl.useProgram(shProgram.prog);
}




function draw() {
    //  Очистка 
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //  Фон і відео
    if (webcamElement && webcamElement.videoWidth > 0) {
        drawVideoBackground();
        
        gl.disableVertexAttribArray(bgProgram.positionLoc);
        gl.disableVertexAttribArray(bgProgram.texCoordLoc);
    }

    //  Основний шейдер
    gl.useProgram(shProgram.prog);

    
    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iVertexBuffer);
    gl.vertexAttribPointer(
        shProgram.iAttribVertex, // атрибут "vertex"
        3, gl.FLOAT, false,      // 3 компоненти float
        0, 0                     // tightly packed
    );
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, surface.iIndexBuffer);

    
    const modelView         = spaceball.getViewMatrix();
    const rotateToCenter    = m4.axisRotation([0.707, 0.707, 0], 0.7);
    const translateAway     = m4.translation(0, 0, -10);

    const fillColor = new Float32Array([0.5, 0.5, 0.5, 1]);
    const edgeColor = new Float32Array([1,   1,   1,   1]);

    // ——— Ліве око ———
    {
        const leftProj = stereoCam.calcLeftFrustum();
        gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, leftProj);

        let mv = m4.multiply(rotateToCenter, modelView);
        mv     = m4.multiply(m4.translation(stereoCam.eyeSeparation/2, 0, 0), mv);
        mv     = m4.multiply(translateAway, mv);
        gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, mv);

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 0);

        gl.colorMask(true, false, false, true);
        gl.uniform4fv(shProgram.iColor, fillColor);
        surface.Draw();

        gl.uniform4fv(shProgram.iColor, edgeColor);
        surface.DrawWireframe();
    }

    // ——— Праве око ———
    {
        gl.clear(gl.DEPTH_BUFFER_BIT);

        const rightProj = stereoCam.calcRightFrustum();
        gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, rightProj);

        let mv = m4.multiply(rotateToCenter, modelView);
        mv     = m4.multiply(m4.translation(-stereoCam.eyeSeparation/2, 0, 0), mv);
        mv     = m4.multiply(translateAway, mv);
        gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, mv);

        gl.colorMask(false, true, true, true);
        gl.uniform4fv(shProgram.iColor, fillColor);
        surface.Draw();

        gl.uniform4fv(shProgram.iColor, edgeColor);
        surface.DrawWireframe();
    }

    
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}



// === Визначаємо функцію ініціалізації основного шейдера ===
function initShaderProgram() {
    
    shProgram = new ShaderProgram("Basic");
    shProgram.init(gl, vertexShaderSource, fragmentShaderSource);
    shProgram.Use();

    
    shProgram.iAttribVertex      = gl.getAttribLocation(shProgram.prog, "vertex");
    shProgram.iModelViewMatrix   = gl.getUniformLocation(shProgram.prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix  = gl.getUniformLocation(shProgram.prog, "ProjectionMatrix");
    shProgram.iColor             = gl.getUniformLocation(shProgram.prog, "color");
    shProgram.iUseTexture        = gl.getUniformLocation(shProgram.prog, "useTexture");
    shProgram.iSampler           = gl.getUniformLocation(shProgram.prog, "uSampler");

    
    gl.uniform1i(shProgram.iSampler, 0);
}





/* Initialize the WebGL context. Called from init() */
function initGL() {
  

    const data = CreateSurfaceData();

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16);
    surface.wireframeIndices = data.wireframeU16; // Додатково зберігаємо каркас


    // TODO: Place your code here to load two triangle geomtery


    stereoCam = new StereoCamera(
        .7,     // decimeters
        14.0,   // decimeters
        1.3,    // aspect ratio of canvas
        0.4,    // radians
        8.0,    // decimeters
        20.0    // decimeters
    );

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

async function initWebcam() {
    webcamElement = document.getElementById("webcam");  
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamElement.srcObject = stream;
        await webcamElement.play();

        // Створюємо й налаштовуємо текстуру для відео
        videoTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (error) {
        console.error("Error accessing webcam:", error);
    }
}


/**
 * initialization function that will be called when the page has loaded
 */
async function init() {

    const canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    //  Базова ініціалізація
    initShaderProgram();
    initGL();

    //  Ініціалізація відео-фону
    await initWebcam();
    initBackgroundShaders();
    gl.enable(gl.DEPTH_TEST);


    video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    await initWebcam();
  


    // Слайдери
    document.getElementById("eyeSepSlider").addEventListener("input", function (e) {
        const val = parseFloat(e.target.value);
        stereoCam.eyeSeparation = val;
        document.getElementById("eyeSepValue").textContent = val.toFixed(2);
        draw();
    });

    document.getElementById("fovSlider").addEventListener("input", function (e) {
        const val = parseFloat(e.target.value);
        stereoCam.FOV = val;
        document.getElementById("fovValue").textContent = val.toFixed(2);
        draw();
    });

    document.getElementById("nearClipSlider").addEventListener("input", function (e) {
        const val = parseFloat(e.target.value);
        stereoCam.nearClippingDistance = val;
        document.getElementById("nearClipValue").textContent = val.toFixed(1);
        draw();
    });

    document.getElementById("convSlider").addEventListener("input", function (e) {
        const val = parseFloat(e.target.value);
        stereoCam.convergence = val;
        document.getElementById("convValue").textContent = val.toFixed(1);
        draw();
    });

    setInterval(draw, 1 / 20);
    spaceball = new TrackballRotator(canvas, draw, 0);
    draw();
}