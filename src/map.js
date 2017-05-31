import * as d3 from "d3"
import * as THREE from "three"
import "./styles/map.less"
import * as input from "./input.js"
import "./global.js"
import { data, event as data_event } from "./data.js"



//lets do a psys here


var particles = [];
var particleFree = [];
var _particleFree_swap = [];
const MAX_PARTICLES = 40000;


for (var i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        ax: 0,
        ay: 0,
        az: 0,
        r: 1,
        g: 1,
        b: 1,
        tr: 1,
        tg: 1,
        tb: 1,
        life: 1,
        lifeV: 0.01,
        tx: 0,
        ty: 0,
        tz: 0,
        targetChase: false,
        bag: {}
    });
}

function allocateParticle() {
    if (particleFree.length > 0) {
        var free = particleFree.pop();
        var cur = particles[free];
        return cur;
    }
    return undefined; //oops
}

function emitParticleAt(x, y, z) {
    var p = allocateParticle();
    if (!p) return; //failed
    p.life = 1;
    p.x = x + (0.5 - Math.random()) * 1000;
    p.y = y + (0.5 - Math.random()) * 1000;
    p.z = z + (0.5 - Math.random()) * 1000;
    p.vz = 0;
    p.az = Math.random();
    p.r = 1;
    p.g = 1;
    p.b = 1;
}


var particle_target = undefined;
// global.particle_target = particle_target;

var highlight = 0;

var shuffle = 0;

global.test_set_target = function (id) {
    //add some force here
    shuffle = 50;
    particle_target = data.map_postfab.points_l[id] ? data.map_postfab.points_l[id] : data.map.points_l;
    console.log(particle_target.length);
}
global.test_set_highlight = function (id) {
    //add some force here
    shuffle = 20;
    highlight = "" + id;
}

function particle_set_highlight(p, i) {
    if (i >= data.map.points_l.length) return;
    if (data.map.points_l[i].id !== highlight) {
        p.tr = p.tg = p.tb = Math.abs(Math.sin(t * 10) * 0.4);
    } else {
        p.tr = p.tg = p.tb = 1;
    }
}

function particle_rushTo(p, index) {
    if (!particle_target || index >= particle_target.length) return;
    //force allocation here -< bad
    p.life = 1; //always alive
    //calculate acc
    var target = particle_target[index];
    p.ax += (target.x - p.x - 1080 / 2) * 0.005;
    p.ay += (1080 / 2 - target.y - p.y) * 0.005;
    p.vx *= 0.93;
    p.vy *= 0.93;
}

function particle_shuffle(p) {
    p.ax += (Math.random() - 0.5) * .2;
    p.ay += (Math.random() - 0.5) * .2;
}

function updateParticles() {
    var cur;
    _particleFree_swap = [];
    shuffle = shuffle > 0 ? shuffle - 1 : 0;
    for (var i = 0; i < particles.length; i++) {
        cur = particles[i];
        cur.ax = 0;
        cur.ay = 0;

        if (particle_target) {
            particle_rushTo(cur, i);
        }
        if (cur.life <= 0) {
            cur.x = 0;
            cur.y = 0;
            cur.z = 0;
            _particleFree_swap.push(i);
            continue;
        }

        particle_set_highlight(cur, i);

        ease(cur, 'tr', 'r');
        ease(cur, 'tg', 'g');
        ease(cur, 'tb', 'b');


        if (shuffle > 0) {
            particle_shuffle(cur);
        }
        //cpu-heavy
        cur.life -= cur.lifeV;
        cur.vx += cur.ax;
        cur.vy += cur.ay;
        cur.vz += cur.az;
        cur.x += cur.vx;
        cur.y += cur.vy;
        cur.z += cur.vz;
    }
    particleFree = _particleFree_swap;
}

function renderParticles() {
    var cur;
    for (var i = 0; i < MAX_PARTICLES; i++) {
        cur = particles[i];
        if (cur.life <= 0) {
            cloud.colors[i].r = 0;
            cloud.colors[i].g = 0;
            cloud.colors[i].b = 0;
            cloud.vertices[i].x = -10000;
            cloud.vertices[i].y = -10000;
            cloud.vertices[i].z = -10000;
        } else {
            cloud.vertices[i].x = cur.x;
            cloud.vertices[i].y = cur.y;
            cloud.vertices[i].z = cur.z;
            cloud.colors[i].r = cur.r;
            cloud.colors[i].g = cur.g;
            cloud.colors[i].b = cur.b;
        }
    }
    cloud.verticesNeedUpdate = true;
    cloud.colorsNeedUpdate = true;
}

//dont ever touch these plz - -
var projector = d3.geoMercator().center([105.5, 38.7]).scale(800).translate([1080 / 2, 1080 / 2]);
var svg = d3.select("svg");
var path = d3.geoPath()
    .projection(projector);

var scene = new THREE.Scene();

var pointCloudMat = new THREE.PointCloudMaterial({
    size: 7, sizeAttenuation: true,
    vertexColors: THREE.VertexColors,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true
});


var cloud = new THREE.Geometry();
for (var i = 0; i < MAX_PARTICLES; i++) {
    cloud.vertices.push(new THREE.Vector3(0, 0, 0));
    cloud.colors.push(new THREE.Color(1, 1, 1));
}

var pointCloud = new THREE.PointCloud(cloud, pointCloudMat);
scene.add(pointCloud);

var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 30000);
camera.position.set(0, 0, 1080 + 80); //and this
scene.add(camera);

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: document.querySelector('#canvasMap') });
renderer.setClearColor(0x000000, 0);
renderer.setSize(1080, 1080);

global.test_state = 0;

export function render() {
    if (data.ready) {
        updateParticles();

        // for (var i = 0; i < 10; i++) {
        //     emitParticleAt(0, 0, 0);
        // }
        renderParticles();
        // camera.position.z = input.mouse.ey + 1080;
        // var points = data.map_postfab.points_uh[global.test_state] ? data.map_postfab.points_uh[global.test_state] : data.map.points_l;
        // for (var i = 0; i < cloud.vertices.length; i++) {
        //     if (i < points.length) {
        //         cloud.vertices[i].x = points[i].x - 1080 / 2 + Math.sin(t * 30 + points[i].y) * 3;
        //         cloud.vertices[i].y = -points[i].y + 1080 / 2 + Math.cos(t * 10 + points[i].x) * 3;
        //         cloud.colors[i].r = 1;
        //         cloud.colors[i].g = 1;
        //         cloud.colors[i].b = 1;
        //     } else {
        //         cloud.colors[i].r = 0;
        //         cloud.colors[i].g = 0;
        //         cloud.colors[i].b = 0;
        //     }
        // }
        renderer.render(scene, camera);
    }
}



//when data arrives
function init() {

    // var cities = d.cities;
    // var counties = d.counties;
    // d.cities = cities.map((c) => {
    //     c.proj = projector(c.pos);
    //     c.projLowRes = [
    //         Math.round(c.proj[0] / s) * s,
    //         Math.round(c.proj[1] / s) * s
    //     ];
    //     return c;
    // });
    // d.counties = counties.map((c) => {
    //     c.proj = projector(c.pos);
    //     c.projLowRes = [
    //         Math.round(c.proj[0] / s) * s,
    //         Math.round(c.proj[1] / s) * s
    //     ];
    //     return c;
    // });

    svg.append("g")
        .attr("class", "map states")
        .selectAll("path")
        .data(data.map.geojson.features)
        .enter().append("path")
        .attr("d", path);

    // loadPoints();
}


data_event.on("ready", init);


