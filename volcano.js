import {defs, tiny} from './common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) { // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) { // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) { // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}

// Use to organize adding any necessary controls
class Volcano_Base extends Scene {
    constructor() {
        super();
    }

    // To add content to the "Volcano" panel (See assignments and "transforms-sandbox.js" for examples)
    make_control_panel() {

    }

    deg_to_rads(angle_in_degree) {
        return angle_in_degree * (Math.PI / 180)
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Also set initial camera position
            program_state.set_camera(Mat4.translation(0, -0.2, -6).times(Mat4.rotation(this.deg_to_rads(20), 1, 0, 0,).times(Mat4.rotation(this.deg_to_rads(160), 0, 1, 0))));
        }
    }
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

export class Volcano extends Volcano_Base {
    constructor() {
        super();

        // Load the object model file:
        this.shapes = {
            "volcano": new Shape_From_File("assets/volcano.obj"),
            "water": new Shape_From_File("assets/water.obj"),
            "base": new Shape_From_File("assets/model_base.obj"),
            "background": new Shape_From_File("assets/background.obj"),
            "medieval_house": new Shape_From_File("assets/medieval_simple_house.obj"),
            "shack": new Shape_From_File("assets/shack.obj"),
            "watchtower": new Shape_From_File("assets/watchtower.obj"),
            "smoke": new Shape_From_File("assets/smoke.obj"),
            "cloud": new Shape_From_File("assets/cloud.obj"),
            "drop": new Shape_From_File("assets/drop.obj"),
            "lava2": new Shape_From_File("assets/lava2.obj"),
            "lava3": new Shape_From_File("assets/lava3.obj")
        };

        // Define material for volcano
        this.background = new Material(new defs.Phong_Shader(1), {
            color: color(40 / 255, 40 / 255, 40 / 255, 1),
            ambient: 0.5,
            diffusivity: .5,
            specularity: 0
        });
        this.video_background = new Material(new defs.Textured_Phong(1), {
            color: color(0, 0, 0, 1),
            ambient: 1,
            diffusivity: 0,
            specularity: 0,
            texture: new Texture("assets/video_img.png")
        });
        this.base = new Material(new defs.Phong_Shader(1), {
            color: color(12 / 255, 12 / 255, 12 / 255, 1),
            ambient: 1,
            diffusivity: 1,
            specularity: 0.2
        });
        this.water = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0.3, 0.4, 1),
            ambient: 1,
            diffusivity: 1,
            specularity: 0.4
        });
        this.volcano = new Material(new defs.Phong_Shader(1), {
            color: color(30 / 255, 30 / 255, 30 / 255, 1),
            ambient: 1,
            diffusivity: 1,
            specularity: 0.1
        });
        this.smoke = new Material(new defs.Phong_Shader(1), {
            color: color(0.5, 0.5, 0.5, 1),
            ambient: .3,
            diffusivity: 1,
            specularity: .5
        });
        this.drop = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0, 1, 1),
            ambient: .3,
            diffusivity: 1,
            specularity: .5
        });
        this.medieval_house = new Material(new defs.Phong_Shader(1), {
            color: color(101 / 255, 69 / 255, 52 / 255, 1),
            ambient: 0.3,
            diffusivity: 0.2,
            specularity: 0
        });
        this.shack = new Material(new defs.Phong_Shader(1), {
            color: color(169 / 255, 104 / 255, 81 / 255, 1),
            ambient: 0.3,
            diffusivity: 0.3,
            specularity: 0
        });
        this.watchtower = new Material(new defs.Phong_Shader(1), {
            color: color(92 / 255, 77 / 255, 77 / 255, 1),
            ambient: 0.2,
            diffusivity: 0.5,
            specularity: 0
        });
        this.lava = new Material(new defs.Phong_Shader(1), {
            color: color(255 / 255, 139 / 255, 57 / 255, 1),
            ambient: 0.2,
            diffusivity: 0.5,
            specularity: 0.5
        });
        this.cloud = new Material(new defs.Phong_Shader(1), {
            color: color(0.5, 0.5, 0.5, 1),
            ambient: 0.8,
            diffusivity: 1
        });
        this.drop = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0, 1, 1),
            ambient: 0.8,
            diffusivity: 1
        });
        this.lava = new Material(new defs.Phong_Shader(1), {
            color: color(1, 0.1, 0, 1),
            ambient: 0.8,
            diffusivity: 0.2
        });

        this.particles = [];
        this.velocity = [];
        this.particles2 = [];
        this.velocity2 = [];
        this.xDrop = 0;
        this.yDrop = 0;
        this.rainOn = 0;
        this.smokeOn = 1;
        this.cyCloude = 8;
        this.cxCloude = 5;
        this.lava2Z = 0;
        this.lava3Z = 0;
        this.lava4Z = 0;
        this.lava5Z = 0;
        this.lava6Z = 0;
        window.attached = 0;

        for (let j = 0; j < 130; j++) {
            this.velocity[j] = getRandomArbitrary(0.2, 1);
        }

        for (let j = 0; j < 50; j++) {
            this.velocity2[j] = getRandomArbitrary(0.1, 0.2);
        }
        this.crosshair_Matrix = Mat4.scale(0.25, 0.25, 0.25).times(Mat4.translation(5, 8, 1.1));

        this.background_toggle = this.background;
    }

    make_control_panel() {
        this.key_triggered_button("Graduation Background on/off", ["b"], this.Banner);
        // () => this.background_toggle = this.background_toggle === this.background ? this.video_background : this.background);
        this.new_line();
        this.key_triggered_button("Rain on/off", ["n"], this.Rain);
        this.key_triggered_button("Smoke on/off", ["m"], this.Smoke);
        this.new_line();
        this.key_triggered_button("Move Left", ["j"], this.move_left);
        this.key_triggered_button("Move Right", ["l"], this.move_right);
        this.key_triggered_button("Move Up", ["i"], this.move_up);
        this.key_triggered_button("Move Down", ["k"], this.move_down);
    }

    move_left() {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0.2, 0, 0));
        this.cxCloude += 0.2;
        this.xDrop += 2.5;
    }

    move_right() {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(-0.2, 0, 0));
        this.cxCloude -= 0.2;
        this.xDrop -= 2.5;
    }

    move_up() {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, 0.2, 0));
        this.cyCloude += 0.2;
        this.yDrop += 2.5;
    }

    move_down() {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, -0.2, 0));
        this.cyCloude -= 0.2;
        this.yDrop -= 2.5;
    }

    Rain() {
        if (this.rainOn === 0) {
            this.rainOn = 1
        } else {
            this.rainOn = 0;
        }
    }

    Smoke() {
        if (this.smokeOn === 0) {
            this.smokeOn = 1
        } else {
            this.smokeOn = 0;
        }
    }

    Banner()
    {
        attached ^= 1;
        if (this.background_toggle === this.background)
        {
            this.background_toggle = this.video_background;
        }
        else 
        {
            this.background_toggle = this.background;
        }
    }



    //######################  Display  ############################\\

    display(context, program_state) {
        super.display(context, program_state);
        const t = program_state.animation_time;

        // Scene setup
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        // program_state.lights = [new Light(Mat4.rotation(250, 1, 0, 0).times(vec4(3, 2, 10, 1)), color(1, 1, 1, 1), 100000)];
        program_state.lights = [new Light(Mat4.rotation(250, 1, 0, 0).times(Mat4.rotation(30, 0, 1, 0)).times(vec4(3, 2, 10, 1)), color(1, 1, 1, 1), 100000)];

        // Scene background
        const background_transform = Mat4.identity()
            .times(Mat4.scale(5, 5, 2.2))
            .times(Mat4.translation(3, -0.35, 7))
            .times(Mat4.rotation(0.56, 0, 1, 0))
            .times(Mat4.rotation(-1.5708, 0, 0, 1));
        this.shapes.background.draw(context, program_state, background_transform, this.background_toggle);
        
        var banner = background_transform;
        

        // Scene base
        const base_transform = Mat4.scale(2, 2, 2)
            .times(Mat4.translation(0, -0.35, 0));
        this.shapes.base.draw(context, program_state, base_transform, this.base);

        // Draw water
        const water_transform = Mat4.scale(1.345, 1.345, 1.345)
            .times(Mat4.translation(0, -0.46, 0));
        this.shapes.water.draw(context, program_state, water_transform, this.water);

        // Draw volcano
        const volcano_transform = Mat4.identity()
            .times(Mat4.translation(0, -0.43, 0))
            .times(Mat4.scale(0.8, 0.8, 0.8));
        this.shapes.volcano.draw(context, program_state, volcano_transform, this.volcano);

        // Draw Smoke
        if (!this.smokeOn)
        {
            this.particles.push(this.smoke);
        }
        else // Clear particles array when effect hidden
        {
            if (this.particles.length > 0)
            {
                this.particles.length = 0;
            }
        }
        // Smoke particles movement component
        for (let i = 0; i < this.particles.length; i++) {
            let smoke_transform = Mat4.scale(
                0.02 + (10 + ((t / ((this.velocity[i]) * 800)) % 30)) * 3 / 1000,
                0.02 + (10 + ((t / ((this.velocity[i]) * 800)) % 30)) * 3 / 1000,
                0.02 + (10 + ((t / ((this.velocity[i]) * 800)) % 30)) * 3 / 1000)
                .times(Mat4.translation(-2 + i / 20, ((t / ((this.velocity[i]) * 800)) % 30), 4));
            if (10 + ((t / ((this.velocity[i]) * 800)) % 30) < 29) {
                let distance = (this.cyCloude + 6.5) - (((t / ((this.velocity[i]) * 800)) % 30));
                let range = this.cyCloude - (-5 + i / 15);
                if (!(this.cxCloude < 1.8 && this.cxCloude > -1.4 && distance < 0.06)) {
                    if (this.smokeOn === 0) {
                        this.shapes.smoke.draw(context, program_state, smoke_transform, this.particles[i]);
                    }
                }
            }
        }

        // Draw rain cloud
        this.shapes.cloud.draw(context, program_state, this.crosshair_Matrix, this.cloud);

        // Draw rain drop
        if (this.rainOn)
        {
            this.particles2.push(this.drop);
        }
        else // Clear particles array when effect hidden
        {
            if (this.particles2.length > 0)
            {
                this.particles2.length = 0;
            }
        }
        //Drop particles
        for (let i = 0; i < this.particles2.length; i++) {
            let model_transform10 = Mat4.scale(0.02, 0.02, 0.02)
                .times(Mat4.translation(55 + i / 2 + this.xDrop, (this.yDrop + 100) - ((t / ((this.velocity2[i]) * 400)) % 120), 20));
            if ((150 - ((t / ((this.velocity2[i]) * 400)) % 120)) > 5) {
                if (this.rainOn === 1) {
                    this.shapes.drop.draw(context, program_state, model_transform10, this.particles2[i]);
                }
            }
        }

        //Draw lava
        let lavaY = -1.3 + t / 10000;
        if (lavaY > 0) {
            lavaY = 0;
        }
        const lava_transform1 = Mat4.scale(0.25, 0.25, 0.25).times(Mat4.translation(0, lavaY, 1.1));
        this.shapes.cloud.draw(context, program_state, lava_transform1, this.lava);

        if (lavaY !== 0) {
            this.lava2Z = -t / 20000;
        }
        if (this.lava2Z < -0.3) {
            this.lava2Z = -0.3;
        }
        const lava_transform2 = Mat4.scale(0.25, 0.25, 0.25).times(Mat4.translation(0, -1.6, this.lava2Z));
        this.shapes.lava2.draw(context, program_state, lava_transform2, this.lava);

        if (this.lava3Z !== -0.3) {
            this.lava3Z = -t / 20000;
        }
        if (this.lava3Z < -0.5) {
            this.lava3Z = -0.5;
        }
        const lava_transform5 = Mat4.scale(0.20, 0.20, 0.20).times(Mat4.translation(-0.91, -1.7, this.lava3Z).times(Mat4.rotation(4.4, 0, 1, 0)));
        this.shapes.lava3.draw(context, program_state, lava_transform5, this.lava);

        if (this.lava3Z !== -0.5) {
            this.lava4Z = -t / 5000;
        }
        if (this.lava4Z < -2.4) {
            this.lava4Z = -2.4;
        }
        const lava_transform4 = Mat4.scale(0.20, 0.20, 0.20).times(Mat4.translation(-1.5, -2.7, this.lava4Z).times(Mat4.rotation(4.4, 0, 1, 0)));
        this.shapes.lava3.draw(context, program_state, lava_transform4, this.lava);

        if (this.lava4Z !== -2.4) {
            this.lava5Z = -t / 3000;
        }
        if (this.lava5Z < -3.42) {
            this.lava5Z = -3.42;
        }
        const lava_transform6 = Mat4.scale(0.20, 0.20, 0.20).times(Mat4.translation(-1.5, -3.2, this.lava5Z).times(Mat4.rotation(4.4, 0, 1, 0)));
        this.shapes.lava3.draw(context, program_state, lava_transform6, this.lava);

        if (this.lava5Z !== -3.42) {
            this.lava6Z = -t / 2500;
        }
        if (this.lava6Z < -5) {
            this.lava6Z = -5;
        }
        const lava_transform3 = Mat4.scale(0.25, 0.241, 0.25).times(Mat4.translation(-0.9, -3.1, this.lava6Z).times(Mat4.rotation(3.7, 1, 0, 1)));
        this.shapes.lava2.draw(context, program_state, lava_transform3, this.lava);

        // Draw buildings
        const shack_transform2 = Mat4.identity()
            .times(Mat4.scale(.05, .05, .05))
            .times(Mat4.translation(-7, -10, -17))
            .times(Mat4.rotation(0.2, 0, 0, 1));
        this.shapes.shack.draw(context, program_state, shack_transform2, this.shack);

        const medieval_house_transform2 = Mat4.identity()
            .times(Mat4.scale(.05, .05, .05))
            .times(Mat4.translation(12, -11, -16))
            .times(Mat4.rotation(0, -0.5, 0.5, 1));
        this.shapes.medieval_house.draw(context, program_state, medieval_house_transform2, this.medieval_house);

        const shack_transform = Mat4.identity()
            .times(Mat4.scale(0.05, 0.05, 0.05))
            .times(Mat4.translation(-11, -9, -13))
            .times(Mat4.rotation(-.1, 0, 1, 0))
            .times(Mat4.rotation(-.25, 1, 0, 0));
        this.shapes.shack.draw(context, program_state, shack_transform, this.shack);

        const watchtower_transform = Mat4.identity()
            .times(Mat4.scale(0.07, 0.07, 0.07))
            .times(Mat4.translation(-11, -6.6, -10));
        this.shapes.watchtower.draw(context, program_state, watchtower_transform, this.watchtower);

        const watchtower2_transform = Mat4.identity()
            .times(Mat4.scale(0.07, 0.07, 0.07))
            .times(Mat4.translation(6, -6.6, -12))
            .times(Mat4.rotation(4, 0, 1, 0));
        // const watchtower2_brown = color(101, 69, 52, 1);
        this.shapes.watchtower.draw(context, program_state, watchtower2_transform, this.watchtower/*.override({color: watchtower2_brown})*/);

        
    }
}