const { cos, sin, sqrt, pow, PI } = Math

const a = 1
const b = 3
const c = 1

const scaler = 0.2;


function deg2rad(angle) {
    return angle * Math.PI / 180;
}


function Vertex(p)
{
    this.p = p;
    this.normal = [];
    this.triangles = [];
}

function Triangle(v0, v1, v2)
{
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.normal = [];
    this.tangent = [];
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;
    this.indicesU16 = null; // Додаємо для зберігання оригінальних індексів
    this.wireframeIndices = null;

    this.BufferData = function(vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);
        
        this.indicesU16 = indices; // Зберігаємо оригінальні індекси
        this.count = indices.length;
    }

    this.wireframeIndices = null;
    this.Draw = function() {
        // Малюємо заповнені трикутники
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
    
    this.DrawWireframe = function() {
        if (!this.wireframeIndices) return;
        
        // Малюємо каркас поверх трикутників
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.wireframeIndices, gl.STREAM_DRAW);
        gl.drawElements(gl.LINES, this.wireframeIndices.length, gl.UNSIGNED_SHORT, 0);
        
        // Повертаємо оригінальні індекси
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indicesU16, gl.STREAM_DRAW);
    }
    
}



function ConicalEdgeVertex(t, u) {

    let x = t * cos(u),
        y = t * sin(u),
        z = c*(a*a-b*b*cos(u)*cos(u));
    return [scaler * x, scaler * y, scaler * z];
}

function CreateSurfaceData() {
    const vertices = [];
    const triangleIndices = [];
    const wireframeIndices = [];

    const NUM_U = 50;
    const NUM_T = 10;
    const MAX_U = Math.PI * 2;
    const MAX_T = 5;
    const STEP_U = MAX_U / NUM_U;
    const STEP_T = MAX_T / NUM_T;

    // === Вершини
    for (let i = 0; i <= NUM_T; i++) {
        for (let j = 0; j <= NUM_U; j++) {
            let t = i * STEP_T;
            let u = j * STEP_U;
            const [x, y, z] = ConicalEdgeVertex(t, u);
            vertices.push(x, y, z);
        }
    }

    const vertsPerRow = NUM_U + 1;

    // ===  Трикутники для заповнення
    for (let i = 0; i < NUM_T; i++) {
        for (let j = 0; j < NUM_U; j++) {
            const idx0 = i * vertsPerRow + j;
            const idx1 = idx0 + 1;
            const idx2 = idx0 + vertsPerRow;
            const idx3 = idx2 + 1;

            // два трикутники на кожен квадрат
            triangleIndices.push(idx0, idx2, idx1);
            triangleIndices.push(idx1, idx2, idx3);
        }
    }

    // ===  Лінії вздовж u (каркас)
    for (let j = 0; j <= NUM_U; j++) {
        for (let i = 0; i < NUM_T; i++) {
            const idx0 = i * vertsPerRow + j;
            const idx1 = (i + 1) * vertsPerRow + j;
            wireframeIndices.push(idx0, idx1);
        }
    }
    
    // ===  Лінії вздовж T (рядки)
    for (let i = 0; i <= NUM_T; i++) {
        for (let j = 0; j < NUM_U; j++) {
            const idx0 = i * vertsPerRow + j;
            const idx1 = i * vertsPerRow + j + 1;
            wireframeIndices.push(idx0, idx1);
        }
    }

    return {
        verticesF32: new Float32Array(vertices),
        indicesU16: new Uint16Array(triangleIndices),
        wireframeU16: new Uint16Array(wireframeIndices)
    };
}