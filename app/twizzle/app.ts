import "babel-polyfill"; // Prevent `regeneratorRuntime is not defined` error. https://github.com/babel/babel/issues/5085
import { Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3 } from "three";
import { algToString, BareBlockMove, BlockMove, experimentalAppendBlockMove, getAlgURLParam, modifiedBlockMove, MoveFamily, parse as algparse, Sequence } from "../../alg";
import { connect, debugKeyboardConnect, MoveEvent } from "../../bluetooth";
import { KPuzzle, KPuzzleDefinition, parse } from "../../kpuzzle";
import { PuzzleGeometry, SchreierSims } from "../../puzzle-geometry";
import { experimentalShowJumpingFlash, Twisty } from "../../twisty";

experimentalShowJumpingFlash(false);

let twisty: Twisty;
let puzzle: KPuzzleDefinition;
let puzzleSelected = false;
const lastPuzzleName = "";
let safeKsolve: string = "";
let movenames: string[];
let grips: any[];
let descinput: HTMLInputElement;
let algoinput: HTMLInputElement;
let actions: HTMLSelectElement;
let moveInput: HTMLSelectElement;
let lastval: string = "";
let lastalgo: string = "";
let scramble: number = 0;
let stickerDat: any;
const renderOptions = ["threed", "centers", "edges", "corners",
  "centers", "edges", "corners", "blockmoves", "vertexmoves"];
const workOptions = ["centers", "edges", "corners", "optimize", "blockmoves",
  "allmoves", "vertexmoves", "killori"];
let lastRender: any;
let gripdepth: any;
function getCheckbox(a: string): boolean {
  return (document.getElementById(a) as HTMLInputElement).checked;
}

function getCheckboxes(a: string[]): any {
  const r: any = {};
  for (const s of a) {
    r[s] = getCheckbox(s);
  }
  return r;
}

function equalCheckboxes(a: string[], b: any, c: any): boolean {
  for (const s of a) {
    if (b[s] !== c[s]) {
      return false;
    }
  }
  return true;
}

function focusRight(): void {
  return;
  algoinput.scrollLeft = algoinput.scrollWidth;
  algoinput.focus();
  algoinput.selectionStart = algoinput.selectionEnd = 100000000;
}

function domove(mv: string, mod: number): void {
  try { // try to merge this move
    const oldalg = algparse((algoinput.value));
    const newmv = algparse((mv));
    if (oldalg instanceof Sequence && newmv instanceof Sequence &&
      newmv.nestedUnits.length === 1 && oldalg.nestedUnits.length > 0) {
      const lastmv = oldalg.nestedUnits[oldalg.nestedUnits.length - 1];
      const thismv = newmv.nestedUnits[0];
      if (lastmv instanceof BlockMove && thismv instanceof BlockMove &&
        lastmv.family === thismv.family &&
        lastmv.outerLayer === thismv.outerLayer &&
        lastmv.innerLayer === thismv.innerLayer) {
        let newAmount = thismv.amount + lastmv.amount;
        const newArr = oldalg.nestedUnits.slice();
        if (newAmount === 0 || (mod > 0 && newAmount % mod === 0)) {
          newArr.length -= 1;
        } else {
          // canonicalize the representation
          while (newAmount + newAmount > mod) {
            newAmount -= mod;
          }
          while (newAmount + newAmount <= -mod) {
            newAmount += mod;
          }
          newArr[oldalg.nestedUnits.length - 1] =
            new BlockMove(lastmv.outerLayer, lastmv.innerLayer,
              lastmv.family, newAmount);
        }
        algoinput.value = (algToString(new Sequence(newArr)));
        focusRight();
        checkchange();
        return;
      }
    }
  } catch (e) {
    // Ignore
  }
  algoinput.value += " " + (mv);
  focusRight();
  checkchange();
}

function intersectionToMove(point: Vector3, event: MouseEvent): BlockMove {
  let bestGrip: MoveFamily;
  let bestProduct: number = 0;
  for (const axis of stickerDat.axis) {
    const product = point.dot(new Vector3(...axis[0]));
    if (product > bestProduct) {
      bestProduct = product;
      bestGrip = axis[1];
    }
  }
  let move = BareBlockMove(bestGrip);
  if (bestProduct > 0) {
    if (event.shiftKey) {
      if (getCheckbox("blockmoves")) {
        move = modifiedBlockMove(move, {family: bestGrip.toLowerCase()});
      } else {
        move = modifiedBlockMove(move, {innerLayer: 2});
      }
    }
  }
  return move;
}

function LucasSetup(pg: PuzzleGeometry, ksolve: string, newStickerDat: any, savealgo: boolean): void {
  safeKsolve = ksolve; // this holds the scrambled position
  puzzle = parse(ksolve);
  const mps = pg.movesetgeos;
  const worker = new KPuzzle(puzzle);
  worker.setFaceNames(pg.facenames.map((_: any) => _[1]));
  gripdepth = {};
  for (const mp of mps) {
    const grip1 = mp[0] as string;
    const grip2 = mp[2] as string;
    // angle compatibility hack
    worker.addGrip(grip1, grip2, mp[4] as number);
    gripdepth[grip1] = mp[4];
    gripdepth[grip2] = mp[4];
  }
  algoinput.style.backgroundColor = "";
  stickerDat = newStickerDat;
  if (savealgo && !trimEq(lastalgo, "")) {
    setAlgo(lastalgo, true);
  } else {
    setAlgo("", true);
  }
}

function trimEq(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function setAlgo(str: string, writeback: boolean): void {
  let seq: Sequence = algparse("");
  const elem = document.querySelector("#custom-example");
  if (elem) {
    // this part should never throw, and we should not need to do
    // it again.  But for now we always do.
    if (!twisty || puzzleSelected) {
      elem.textContent = "";
      twisty = new Twisty(elem, {
        puzzle,
        alg: new Sequence([]),
        playerConfig: {
          visualizationFormat: "PG3D",
          experimentalPG3DStickerDat: stickerDat,
        },
      });
      puzzleSelected = false;
    }
    str = str.trim();
    algoinput.style.backgroundColor = "";
    // without the true, type U then erase it, the cube won't
    // go back to solved, so without the setAlg() the state isn't
    // consistently being updated.  TOFIX
    if (true || str.length !== 0) {
      try {
        seq = algparse(str);
        str = algToString(seq);
        twisty.experimentalSetAlg(seq);
      } catch (e) {
        algoinput.style.backgroundColor = "#ff8080";
        console.log("Could not parse " + str);
      }
    }
    if (writeback) {
      algoinput.value = (str);
      lastalgo = str;
    }
  }
}
// this is so horrible.  there has to be a better way.
function showtext(s: string): void {
  const wnd = window.open("", "_blank");
  if (wnd) {
    wnd.document.open("text/plain", "replace");
    wnd.document.write("<pre>");
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    wnd.document.write(s);
    wnd.document.write("</pre>");
    wnd.document.close();
  }
}

function gettextwriter(): (s: string) => void {
  const wnd = window.open("", "_blank");
  if (wnd) {
    wnd.document.open("text/plain", "replace");
    wnd.document.write("<pre>");
    return (s: string) => {
      s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (wnd && wnd.document) {
        wnd.document.write(s + "\n");
      }
    };
  }
  throw new Error("Could not open window");
}

function dowork(cmd: string): void {
  if (cmd === "scramble") {
    scramble = 1;
    checkchange();
    return;
  }
  if (cmd === "reset") {
    scramble = -1;
    checkchange();
    return;
  }
  if (cmd === "bluetooth" || cmd === "keyboard") {
    (async () => {
      const inputPuzzle = await (cmd === "bluetooth" ? connect : debugKeyboardConnect)();
      inputPuzzle.addMoveListener((e: MoveEvent) => {
        const currentAlg = algparse(algoinput.value);
        const newAlg = experimentalAppendBlockMove(currentAlg, e.latestMove, true);
        // TODO: Avoid round-trip through string?
        setAlgo(algToString(newAlg), true);
      });
    })();
    return;
  }
  if (cmd === "help") {
    window.open("Help.html", "Twizzle Help");
    return;
  }
  if (cmd === "options") {
    const el = document.getElementById("optionsspan");
    const el2 = document.getElementById("data");
    if (el && el2) {
      if (el.style.display !== "none") {
        el.style.display = "none";
        el2.style.display = "none";
      } else {
        el.style.display = "inline";
        el2.style.display = "inline";
      }
    }
    return;
  }
  const options: Array<number | string | boolean> = [];
  const checkboxes = getCheckboxes(workOptions);
  if (checkboxes.allmoves) {
    options.push("allmoves", true);
  }
  if (checkboxes.vertexmoves) {
    options.push("vertexmoves", true);
  }
  if (!checkboxes.corners) {
    options.push("cornersets", false);
  }
  if (!checkboxes.edges) {
    options.push("edgesets", false);
  }
  if (!checkboxes.centers) {
    options.push("centersets", false);
  }
  if (checkboxes.optimize) {
    options.push("optimize", true);
  }
  if (checkboxes.blockmoves) {
    options.push("outerblockmoves", true);
  }
  if (checkboxes.killori) {
    options.push("killorientation", true);
  }
  const p = PuzzleGeometry.parsedesc(descinput.value);
  const pg = new PuzzleGeometry(p[0], p[1], options);
  pg.allstickers();
  pg.genperms();
  if (cmd === "gap") {
    showtext(pg.writegap());
  } else if (cmd === "ss") {
    const gtw = gettextwriter();
    const os = pg.getOrbitsDef(false);
    const as = os.reassemblySize();
    gtw("Reassembly size is " + as);
    const ss = SchreierSims.schreiersims(pg.getMovesAsPerms(), gtw);
    const r = as / ss;
    gtw("Ratio is " + r);
  } else if (cmd === "canon") {
    pg.showcanon(gettextwriter());
  } else if (cmd === "ksolve") {
    showtext(pg.writeksolve("TwizzlePuzzle", false));
  } else if (cmd === "svgcmd") {
    showtext(pg.generatesvg(800, 500, 10, getCheckbox("threed")));
  } else {
    alert("Command " + cmd + " not handled yet.");
  }
}

function checkchange(): void {
  // for some reason we need to do this repeatedly
  const descarg = descinput.value;
  if (descarg === null) {
    return;
  }
  let algo = (algoinput.value);
  if (algo === null) {
    return;
  }
  const newRender = getCheckboxes(renderOptions);
  const renderSame = trimEq(descarg, lastval) &&
    equalCheckboxes(renderOptions, lastRender, newRender);
  if (scramble === 0 && trimEq(algo, lastalgo) && renderSame) {
    return;
  }
  if (scramble !== 0 || lastval !== descarg || !renderSame) {
    puzzleSelected = true;
    let savealg = true;
    lastval = descarg;
    lastRender = newRender;
    const p = PuzzleGeometry.parsedesc(descarg);
    if (p) {
      const options: Array<string | number | boolean> =
        ["allmoves", true, "orientcenters", true];
      if (!lastRender.corners) {
        options.push("cornersets", false);
      }
      if (!lastRender.edges) {
        options.push("edgesets", false);
      }
      if (!lastRender.centers) {
        options.push("centersets", false);
      }
      if (scramble !== 0) {
        if (scramble > 0) {
          options.push("scramble", 1);
        }
        scramble = 0;
        algo = "";
        safeKsolve = "";
        savealg = false;
      }
      const pg = new PuzzleGeometry(p[0], p[1], options);
      pg.allstickers();
      pg.genperms();
      const sep = "\n";
      const text =
        "Faces " + pg.baseplanerot.length + sep +
        "Stickers per face " + pg.stickersperface + sep +
        "Cubies " + pg.cubies.length + sep +
        "Short edge " + pg.shortedge + sep +
        "Edge distance " + pg.edgedistance + sep +
        "Vertex distance " + pg.vertexdistance;
      const el = document.getElementById("data");
      if (el) {
        el.title = text;
      }
      let ksolvetext: string;
      if (renderSame && safeKsolve !== "") {
        ksolvetext = safeKsolve;
      } else {
        ksolvetext = pg.writeksolve("TwizzlePuzzle", true);
        movenames = pg.ksolvemovenames;
      }
      const newStickerDat = pg.get3d(0.0131);
      grips = pg.svggrips;
      LucasSetup(pg, ksolvetext, newStickerDat, savealg);
    }
    if (!savealg) {
      lastalgo = "";
      algo = (algoinput.value);
    }
  }
  if (!trimEq(lastalgo, algo)) {
    lastalgo = algo;
    let toparse = "";
    if (algo.trim().length > 0) {
      toparse = algo;
    } else {
      toparse = "";
    }
    if (puzzle) {
      setAlgo(toparse, false);
    }
  }
}

function doaction(el: any): void {
  const s = el.target.value;
  if (s !== "") {
    actions.selectedIndex = 0;
    dowork(s);
  }
}

function doMoveInputSelection(el: any): void {
  const s = el.target.value;
  if (s !== "") {
    actions.selectedIndex = 0;
    dowork(s);
  }
}

function doselection(el: any): void {
  if (el.target.value !== "") {
    puzzleSelected = true;
    descinput.value = el.target.value;
    checkchange();
  }
}

function getQueryParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) || "";
}
// encode ' as -, and ' ' as _, in algorithms
/* not used yet
function encodealg(s:string) {
   return s.replace(/ /g, "_").replace(/'/g, "-") ;
}
 */
const raycaster = new Raycaster();
const mouse = new Vector2();
function onMouseMove(event: MouseEvent): void {
  // calculate mouse position in normalized device coordinates
  // (-1 to +1) for both components

  const canvas: HTMLCanvasElement = twisty.experimentalGetPlayer().element.querySelector("cube3d-view > canvas");

  mouse.x = ((event.offsetX - canvas.offsetLeft) / canvas.offsetWidth) * 2 - 1;
  mouse.y = -(((event.offsetY - canvas.offsetTop) / canvas.offsetHeight) * 2 - 1);
  render(event);
}

function onMouseClick(event: MouseEvent): void {
  // calculate mouse position in normalized device coordinates
  // (-1 to +1) for both components

  const canvas: HTMLCanvasElement = twisty.experimentalGetPlayer().element.querySelector("cube3d-view > canvas");

  mouse.x = ((event.offsetX - canvas.offsetLeft) / canvas.offsetWidth) * 2 - 1;
  mouse.y = -(((event.offsetY - canvas.offsetTop) / canvas.offsetHeight) * 2 - 1);
  render(event, true);
}
/*
 *   Need camera, scene, renderer
 */
function render(event: MouseEvent, clicked: boolean = false): void {

  // update the picking ray with the camera and mouse position
  if (!twisty) {
    return;
  }
  const vantage = (twisty.experimentalGetPlayer().pg3DView.experimentalGetPG3D()).experimentalGetVantages()[0];
  const scene = (twisty.experimentalGetPlayer().pg3DView.experimentalGetPG3D()).experimentalGetScene();
  const camera = vantage.camera;
  const renderer = vantage.renderer;
  raycaster.setFromCamera(mouse, camera);

  // calculate objects intersecting the picking ray
  if (clicked) {
    const controlTargets = twisty.experimentalGetPlayer().pg3DView.experimentalGetPG3D().experimentalGetControlTargets();
    const intersects = raycaster.intersectObjects(controlTargets);
    if (intersects.length > 0) {
      twisty.experimentalAddMove(intersectionToMove(intersects[0].point, event));
    }
  }
  renderer.render(scene, camera);
}

export function setup(): void {
  const select = document.getElementById("puzzleoptions") as HTMLSelectElement;
  descinput = document.getElementById("desc") as HTMLInputElement;
  algoinput = document.getElementById("algorithm") as HTMLInputElement;
  const puzzledesc = PuzzleGeometry.getpuzzles();
  lastRender = getCheckboxes(renderOptions);
  const puz = getQueryParam("puzzle");
  const puzdesc = getQueryParam("puzzlegeometry");
  let found = false;
  for (let i = 0; i < puzzledesc.length; i += 2) {
    const opt = document.createElement("option") as HTMLOptionElement;
    opt.value = puzzledesc[i];
    opt.innerHTML = puzzledesc[i + 1];
    if (puzdesc === "" && puz === puzzledesc[i + 1]) {
      opt.selected = true;
      descinput.value = puzzledesc[i];
      found = true;
    }
    select.add(opt);
  }
  if (puzdesc !== "") {
    select.selectedIndex = 0;
    descinput.value = puzdesc;
  } else if (!found) {
    for (let i = 0; i < puzzledesc.length; i += 2) {
      if (puzzledesc[i + 1] === "3x3x3") {
        select.selectedIndex = 1 + i / 2;
        descinput.value = puzzledesc[i];
      }
    }
  }
  select.onchange = doselection;
  actions = document.getElementById("action") as HTMLSelectElement;
  actions.onchange = doaction;
  moveInput = document.getElementById("move-input") as HTMLSelectElement;
  moveInput.onchange = doMoveInputSelection;
  const commands = ["scramble", "help", "reset", "options"];
  for (const command of commands) {
    (document.getElementById(command) as HTMLInputElement).onclick =
      () => { dowork(command); };
  }
  const qalg = algToString(getAlgURLParam("alg"));
  if (qalg !== "") {
    algoinput.value = qalg;
    lastalgo = qalg;
  }
  checkchange();
  setInterval(checkchange, 0.5);

  window.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("click", onMouseClick, false);
}