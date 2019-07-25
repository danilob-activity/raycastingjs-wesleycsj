var textarea = document.getElementById("code");
var canvas = document.getElementById("render-canvas");
var ctx = canvas.getContext("2d");
var aspect = canvas.width / canvas.height;
var save = document.getElementById("save");
var max = -1000;
var min = 1000;
//valores da projeção
var near = 0.1;
var far = 1000.;
var angle = 45;
var stop = false;
var objects = [];

point_intersection = null;

function updateScene() {
    restart();
    eval(textarea.value);
}

function restart() {
    objects = [];
}

function addObject(obj) {
    objects.push(obj);
}

//define o tamanho da janela
function sizeWindow(w, h) {
    canvas.height = h;
    canvas.width = w;
    aspect = canvas.width / canvas.height;
}

//TODO:coloque uma função para especificar a projeção


textarea.addEventListener("input", updateScene());

function renderCanvas() {
    //python -m SimpleHTTPServer 8000
    updateScene();
    stop = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    hl = 2 * near * Math.tan(angle * Math.PI / 360.);
    wl = hl * aspect;

    deltaY = hl / canvas.height;
    deltaX = wl / canvas.width;

    var luz_amb = new Vec3(1, 1, 1); //componente ambiente

    var luz_pontual_a = new Vec3(0.1, 0.1, 0.1); //componente ambiente
    var luz_pontual_d = new Vec3(0.8, 0.8, 0.8); //componente difusa
    var luz_pontual_s = new Vec3(1, 1, 1); //componente especular
    var luz_pontual_p = new Vec3(15, 15, 0);
    var luz_pontual_att = new Vec3(1, 0, 0);

    //TODO:coloque uma função para especificar a câmera via interface
    var camera = new Camera();
    camera.eye = new Vec3(0, 0, 15.);
    camera.at = new Vec3(0, 0, 0);
    camera.up = new Vec3(0, 1., 0);
    console.log("Objects: " + objects.length);
    var Vec = new Vec3();
    for (var i = 0; i < canvas.width; i++) {
        for (var j = 0; j < canvas.height; j++) {
            var xc = -wl / 2 + deltaX / 2 + i * deltaX;
            var yc = -(-hl / 2 + deltaY / 2 + j * deltaY);
            var point = new Vec3(xc, yc, -near);

            var o = new Vec3(0, 0, 0); //origem de câmera
            var d = new Vec3(point.x, point.y, point.z);
            var ray = new Ray(o, d);
            var intercept = false;
            var result = 0;
            for (var k = 0; k < objects.length; k++) {
                var shape = objects[k];
                var ray_w = new Ray(multVec4(camera.lookAt(), ray.o), multVec4(camera.lookAt(), ray.d));
                //raio transformado em coordenadas do mundo
                var nResult = shape.testIntersectionRay(ray_w);    
                    if (nResult[0]) {
                        if(result==0) result = nResult;
                        else if (nResult[3] < result[3]) {
                            result = nResult;
                        }
                    }
                
            }

            if (result != 0) {

                intercept = true;
                var position = result[1];
                var normal = result[2];
                var viewer = camera.eye;
                var shape = result[4];
                var texture = result[5];

                //verificar sombra
                //fazer teste com todas as luzes
                var is_shadow = false;
                //console.log("inicio do teste");
                for (var n = 0; n < objects.length; n++) {
                    if (objects[n] != shape) {
                        var shapet = objects[n];
                        //console.log("testando com: "+shapet.name);

                        var ray_s = new Ray(position, luz_pontual_p);
                        var nResult = shapet.testIntersectionRay(ray_s);
                        if (nResult[0]) {
                            //if (nResult[3] < Vec.module(Vec.minus(point, luz_pontual_p))) {
                                is_shadow = true;
                                break;
                            //}
                        }
                    }
                }
                var colorF;

                // if (is_shadow) {
                //     var colorF = Vec.compond(shape.ambient, luz_pontual_a);
                // } else {
                    //console.log(shape.name);
                    var Ma, Md, Me;
                    if (texture == null) {
                        Ma = shape.ambient;
                        Md = shape.diffuse;
                        Me = shape.specular;
                    } else {
                        Ma = texture;
                        Md = texture;
                        Me = texture;
                    }

                    var amb = Vec.compond(Ma, luz_pontual_a);
                    var l = Vec.minus(luz_pontual_p, position);
                    var v = Vec.minus(position, viewer);

                    var d = Vec.module(Vec.minus(position, luz_pontual_p));
                    var att = 1. / (luz_pontual_att.x + luz_pontual_att.y * d + luz_pontual_att.z * d * d);
                    var factor_diff = 0;
                    if (Vec.dot(l, normal) > 0) {
                        factor_diff = Math.max(Vec.dot(l, normal) / (Vec.module(l) * Vec.module(normal)), 0);
                    }
                    //material do objeto com a luz -> cor difusa

                    var diff = Vec.compond(Md, luz_pontual_d);
                    //aplicando o fator e a atenuação
                    diff = Vec.prod(diff, att * factor_diff);

                    //parte especular
                    //var l = Vec.unitary(l);
                    var r = Vec.minus(Vec.prod(Vec.prod(normal, Vec.dot(l, normal)), 2), l);
                    var h = Vec.unitary(Vec.minus(v, luz_pontual_p));
                    r = Vec.unitary(Vec.sum(r, h));
                    factor_spe = 0;
                    if (Vec.dot(r, normal) > 0) {
                        factor_spe = Math.max(Math.pow(Vec.dot(r, normal), shape.shine), 0);
                    }
                    //material do objeto com a luz -> cor especular
                    var spe = Vec.compond(Me, luz_pontual_s);
                    //aplicando o fator e a atenuação
                    spe = Vec.prod(spe, att * factor_spe);
                    colorF = Vec.sum(amb, Vec.sum(diff, spe));
                    if(is_shadow){
                        colorF = Vec.prod(Vec.sum(diff, amb),0.7);
                    }
                //}
                ctx.fillStyle = "rgb(" + Math.min(colorF.x, 1) * 255 + "," + Math.min(colorF.y, 1) * 255 + "," + Math.min(colorF.z, 1) * 255 + ")";
                ctx.fillRect(i, j, 1, 1);
            }
            if (!intercept) {
                ctx.fillStyle = "rgb(" + 255 + "," + 255 + "," + 255 + ")";
                ctx.fillRect(i, j, 1, 1);
            }

        }
    }
    stop = false;

}


save.addEventListener("click", function () {
    var fullQuality = canvas.toDataURL('image/png', 1.0);
    window.location.href = fullQuality;
});


