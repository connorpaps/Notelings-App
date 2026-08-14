import type { BuilderCategory, BuilderItem, BuilderTransform } from './OfficeBuilderContext'
import type { WallSegment } from './officeLayout'

const SOURCE_PLACEMENT_IDS: Record<string, string> = {
  door: 'door',
  'plant-door-2': 'plant-door-2',
  'couch-white': 'couch-white',
  'plant-lounge': 'plant-lounge',
  'plant-front': 'plant-front',
  trashcan: 'trashcan',
  'wall:wall-left-lower-ff9645fe': 'wall-left-lower',
  'wall:wall-left-lower-ec5f6919': 'wall-left-lower',
  'wall:wall-left-lower-47027739': 'wall-left-lower',
  '/models/3D_Office_Obj_As-839149d2': 'cabinet-1',
  '/models/3D_Office_Obj_As-37462ea4': 'printer-desk',
  '/models/3D_Office_Obj_As-3eb22b74': 'printer',
  '/models/3D_Office_Obj_As-8c9df686': 'papers',
  '/models/3D_Office_Obj_As-e2737c9c': 'coffee-machine',
  '/models/3D_Office_Obj_As-afe874bd': 'coffee-pot',
  '/models/3D_Office_Obj_As-e9c6881f': 'mug',
  '/models/3D_Office_Obj_As-724e7236': 'phone',
  '/models/3D_Office_Obj_As-1cfd76ed': 'wall-clock',
  '/models/3D_Office_Obj_As-cbc32684': 'pc-1',
  '/models/3D_Office_Obj_As-2003a497': 'whiteboard',
  '/models/3D_Office_Obj_As-4e167233': 'printer-chair',
}

type Vec3 = [number, number, number]

function model(
  id: string,
  assetId: string,
  name: string,
  category: BuilderCategory,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1],
): BuilderItem {
  const transform: BuilderTransform = { position, rotation, scale }
  return { id, assetId, name, category, kind: 'model', sourcePlacementId: SOURCE_PLACEMENT_IDS[id], transform }
}

function wall(
  id: string,
  assetId: string,
  name: string,
  position: Vec3,
  rotation: Vec3,
  scale: Vec3,
  definition: WallSegment,
): BuilderItem {
  return { id, assetId, name, category: 'Architecture', kind: 'wall', sourcePlacementId: SOURCE_PLACEMENT_IDS[id], transform: { position, rotation, scale }, wall: definition }
}

const pathAsset = (obj: string, mtl: string) => `${obj}|${mtl}`
const A = '/models/3D_Office_Obj_Assets'

const doorAsset = pathAsset(`${A}/Misc/Office_Misc_Door_01.obj`, `${A}/Misc/Office_Misc_Door_01.mtl`)
const plant02Asset = pathAsset(`${A}/Misc/Office_Misc_Plant_02.obj`, `${A}/Misc/Office_Misc_Plant_02.mtl`)
const plant03Asset = pathAsset(`${A}/Misc/Office_Misc_Plant_03.obj`, `${A}/Misc/Office_Misc_Plant_03.mtl`)
const couchWhiteAsset = pathAsset(`${A}/Chairs/Office_Couch_White_01.obj`, `${A}/Chairs/Office_Couch_White_01.mtl`)
const trashcanAsset = pathAsset(`${A}/Misc/Trashcans/Office_Misc_Trashcan_Small_01.obj`, `${A}/Misc/Trashcans/Office_Misc_Trashcan_Small_01.mtl`)
const cabinetAsset = pathAsset(`${A}/Misc/Office_Misc_Cabinet_01.obj`, `${A}/Misc/Office_Misc_Cabinet_01.mtl`)
const printerTableAsset = pathAsset(`${A}/Tables/Office_Table_White_2x1_01.obj`, `${A}/Tables/Office_Table_White_2x1_01.mtl`)
const printerAsset = pathAsset(`${A}/Misc/Electronics/Office_Misc_Printer.obj`, `${A}/Misc/Electronics/Office_Misc_Printer.mtl`)
const papersAsset = pathAsset(`${A}/Misc/Office_Misc_Papers.obj`, `${A}/Misc/Office_Misc_Papers.mtl`)
const coffeeMachineAsset = pathAsset(`${A}/Misc/Coffee/Office_Misc_Coffee_Machine_01.obj`, `${A}/Misc/Coffee/Office_Misc_Coffee_Machine_01.mtl`)
const coffeePotAsset = pathAsset(`${A}/Misc/Coffee/Office_Misc_Coffee_Pot_01.obj`, `${A}/Misc/Coffee/Office_Misc_Coffee_Pot_01.mtl`)
const mugAsset = pathAsset(`${A}/Misc/Coffee/Office_Misc_Coffee_Mug.obj`, `${A}/Misc/Coffee/Office_Misc_Coffee_Mug.mtl`)
const phoneAsset = pathAsset(`${A}/Misc/Electronics/Office_Misc_Phone.obj`, `${A}/Misc/Electronics/Office_Misc_Phone.mtl`)
const chairWhiteAsset = pathAsset(`${A}/Chairs/Office_Chair_White_01.obj`, `${A}/Chairs/Office_Chair_White_01.mtl`)
const pc01Asset = pathAsset(`${A}/Misc/Electronics/Office_Misc_PC_01.obj`, `${A}/Misc/Electronics/Office_Misc_PC_01.mtl`)
const wallClockAsset = pathAsset(`${A}/Misc/Office_Misc_Wall_Clock_01.obj`, `${A}/Misc/Office_Misc_Wall_Clock_01.mtl`)
const corkboardAsset = pathAsset(`${A}/Misc/Office_Misc_Wall_Corkboard_01.obj`, `${A}/Misc/Office_Misc_Wall_Corkboard_01.mtl`)
const whiteboardAsset = pathAsset(`${A}/Misc/Office_Misc_Whiteboard_01.obj`, `${A}/Misc/Office_Misc_Whiteboard_01.mtl`)

const negativeZ: WallSegment = { id: 'wall-negative-z', cell: [0, 0], lenCells: 18, axis: 'x', height: 3.4, thickness: 0.25 }
const leftLower: WallSegment = { id: 'wall-left-lower', cell: [0, 12], lenCells: 2, axis: 'z', height: 3.4, thickness: 0.25 }
const leftUpper: WallSegment = { id: 'wall-left-upper', cell: [0, 1], lenCells: 9, axis: 'z', height: 3.4, thickness: 0.25 }

/** The approved 2026-08-07 builder export. Keep transforms exact unless a new export is promoted. */
export const LOCKED_DEFAULT_ITEMS: BuilderItem[] = [
  model('door', doorAsset, 'Office door', 'Utilities', [-12.6342788421231, 0, 2.244961804805209], [0, 1.5707963267948966, 0]),
  model('plant-door-2', plant02Asset, 'Plant near door', 'Plants', [-12.264296747257895, 0, 4.104366521765947]),
  model('couch-white', couchWhiteAsset, 'White lounge couch', 'Seating', [-8.64189200207688, 0, -6.823626210001921]),
  model('plant-lounge', plant03Asset, 'Lounge plant', 'Plants', [-12.201462992626661, 0, 0.7552329586509012]),
  model('plant-front', plant02Asset, 'Front plant', 'Plants', [-6.89986389963866, 0, -6.9385940000791315]),
  model('trashcan', trashcanAsset, 'Small trashcan', 'Utilities', [-10.967425316986956, 0, -0.728739086476208], [0, 1.55, 0]),
  wall('wall-negative-z', 'wall:wall-negative-z', 'negative z', [-1.6618926649171541, 1.7, -7.646948261059528], [0, 0, 0], [0.9, 1, 1], negativeZ),
  wall('wall-left-lower', 'wall:wall-left-lower', 'left lower', [-12.07146237204977, 1.706, -0.2854777413038001], [0, 1.5, 0], [1, 1, 0.75], leftLower),
  { id: 'office-floor', assetId: 'procedural-office-floor', name: 'Office floor', category: 'Architecture', kind: 'floor', sourcePlacementId: 'office-floor', transform: { position: [-2.3394196359495605, 0, -1.441740372008582], rotation: [0, 0, 0], scale: [0.95, 1, 0.8] } },
  wall('wall:wall-left-lower-8679ee7a', 'wall:wall-left-lower', 'left lower', [-11.24561770104351, 1.7061403046179815, -6.333138044167956], [0, 0, 0], [1, 1, 1], leftLower),
  wall('wall:wall-left-lower-aa79ac0b', 'wall:wall-left-lower', 'left lower copy', [-11.234773581627179, 1.7061403046179815, -3.922635634549186], [0, 0, 0], [1, 1, 1], leftLower),
  wall('wall:wall-left-lower-b9ca6c89', 'wall:wall-left-lower', 'left lower copy copy', [-11.26027556488428, 1.7061403046179815, -1.5349985531562496], [0, 0, 0], [1, 1, 1], leftLower),
  wall('wall:wall-left-lower-ff9645fe', 'wall:wall-left-lower', 'left lower copy', [-12.824450328867643, 1.706, 0.5129501535560643], [0, 0, 0], [1, 1, 0.75], leftLower),
  wall('wall:wall-left-lower-ec5f6919', 'wall:wall-left-lower', 'left lower copy', [-12.821933810033737, 1.706, 2.2735639613342884], [0, 0, 0], [1, 1, 0.75], leftLower),
  wall('wall:wall-left-lower-47027739', 'wall:wall-left-lower', 'left lower copy copy copy', [-12.822983142648779, 1.706, 4.01254082327385], [0, 0, 0], [1, 1, 0.75], leftLower),
  model('/models/3D_Office_Obj_As-3bd947d8', plant03Asset, 'Lounge plant copy', 'Plants', [-10.560938076497754, 0, -6.764351785144853]),
  model('asset:cubicles-office-cu-d8c07059', 'asset:cubicles-office-cubicle-white-05', 'Cubicle White 05', 'Cubicles', [0.9591354997294075, -0.1242321397049384, -5.919002009941877], [0, 1.57, 0]),
  model('asset:cubicles-office-cu-39b0d580', 'asset:cubicles-office-cubicle-white-05', 'Cubicle White 05', 'Cubicles', [0.9421089879696272, -0.1423496411703904, -2.768118508372195]),
  wall('wall:wall-left-upper-94439abc', 'wall:wall-left-upper', 'left upper', [-0.7912856966885302, 1.142133955472957, -2.9564543328684727], [0, 0, 0], [1, 1, 0.85], leftUpper),
  wall('wall:wall-negative-z-0f92839c', 'wall:wall-negative-z', 'negative z', [-4.1533991369724355, 1.134902814443191, 1.5053659159010118], [0, 0, 0], [0.3, 1, 1.0002], negativeZ),
  model('/models/3D_Office_Obj_As-839149d2', cabinetAsset, 'Tall filing cabinet 1', 'Architecture', [7.311791116578309, 0, -6.812224468381732]),
  model('/models/3D_Office_Obj_As-47bd4329', cabinetAsset, 'Tall filing cabinet 1 copy', 'Architecture', [6.263743636805762, 0, -6.798304634295842]),
  model('/models/3D_Office_Obj_As-37462ea4', printerTableAsset, 'White 2x1 table (printer station)', 'Tables', [3.3707515021852217, -0.022962427782796446, -3.1461806668884686], [0, 1.55, 0], [1, 1, 1.1]),
  model('/models/3D_Office_Obj_As-3eb22b74', printerAsset, 'Printer', 'Electronics', [3.4132448525146737, 1.0980913075355292, -2.4955851123078587], [0, 1.55, 0], [0.9, 0.9, 0.9]),
  model('/models/3D_Office_Obj_As-8c9df686', papersAsset, 'Papers', 'Utilities', [3.5241871765877146, 1.217767764274444, -3.8156641142429617], [0, 1.55, 0], [0.9, 0.9, 0.9]),
  model('asset:tables-office-tabl-6fa29d7e', 'asset:tables-office-table-coffee-02-white', 'Table Coffee 02 White', 'Tables', [-8.958432823070503, -0.019160272114501442, -3.953665787322876], [0, 1.5505, 0]),
  model('asset:tables-office-tabl-a51a9f00', 'asset:tables-office-table-white-2x2-02', 'Table White 2x2 02', 'Tables', [6.238341147401275, 0, 3.090091806763086], [0, 3.15, 0]),
  model('asset:tables-office-tabl-6d866f1e', 'asset:tables-office-table-white-1x1-01', 'Table White 1x1 01', 'Tables', [-4.537700983837173, 0, -7.012898533798145], [0, 0, 0], [1.1, 1, 1.35]),
  model('/models/3D_Office_Obj_As-e2737c9c', coffeeMachineAsset, 'Coffee machine', 'Coffee', [-4.55030346060976, 1.124167110366273, -6.763855036600834]),
  model('/models/3D_Office_Obj_As-afe874bd', coffeePotAsset, 'Coffee pot', 'Coffee', [-4.540519894408156, 1.2175248694778293, -6.6999822569034695]),
  model('/models/3D_Office_Obj_As-e9c6881f', mugAsset, 'Coffee mug', 'Coffee', [-8.769049043641402, 0.5056728438482319, -3.1914303735702227]),
  model('/models/3D_Office_Obj_As-724e7236', phoneAsset, 'Phone', 'Electronics', [5.308707022266411, 1.1132460292260564, 3.9742674970200746], [-3.141592653589793, 0, -3.141592653589793]),
  model('asset:misc-electronics-o-3d77695f', 'asset:misc-electronics-office-misc-fax', 'Misc Fax', 'Electronics', [0, 1.093360331466043, 0.468672181631002], [0, 1.55, 0], [0.85, 0.85, 0.85]),
  model('asset:tables-office-tabl-be0161f6', 'asset:tables-office-table-white-3x1-01', 'Table White 3x1 01', 'Tables', [-3.805698650644114, 0, 2.2738733837030787]),
  model('asset:tables-office-tabl-4031ce48', 'asset:tables-office-table-white-1x1-02', 'Table White 1x1 02', 'Tables', [-0.024947974134478468, 0, 0.5208604557233425], [-3.141592653589793, 1.5586814272261538, -3.141592653589793]),
  model('/models/3D_Office_Obj_As-4e167233', chairWhiteAsset, 'Office chair (printer)', 'Seating', [5.379388451000038, -0.020063704936736038, 2.127231557268942], [0, 0.28839090093623987, 0]),
  model('asset:misc-electronics-o-7b8cacbd', 'asset:misc-electronics-office-misc-tablet', 'Misc Tablet', 'Electronics', [7.046441732595469, 1.1266457726337622, 2.5496866731900454], [0, 0.2668678237654198, 0]),
  model('asset:misc-electronics-o-cc6ade45', 'asset:misc-electronics-office-misc-tv-wall-03', 'Misc TV Wall 03', 'Electronics', [-10.528530838458597, 1.106068169497762, -3.9000201708262976], [0, 1.55, 0], [1.1, 1.1, 1]),
  model('/models/3D_Office_Obj_As-1cfd76ed', wallClockAsset, 'Wall clock', 'Wall Decor', [-11.913133927575686, 1.7909829583907442, 0.6643386059920102]),
  model('/models/3D_Office_Obj_As-1bd80fdb', corkboardAsset, 'Corkboard', 'Wall Decor', [-2.439376311964213, 1.3662289420361744, 2.522236997688889]),
  model('asset:misc-office-misc-p-82361e4f', 'asset:misc-office-misc-pictureframe-01', 'Misc PictureFrame 01', 'Wall Decor', [-9.346598514702222, 2.1376092985701867, -7.485952745245598]),
  model('asset:misc-office-misc-p-bcebb1a7', 'asset:misc-office-misc-pictureframe-02', 'Misc PictureFrame 02', 'Wall Decor', [-8.32085178570539, 1.8078879215924806, -7.500029349926335]),
  model('asset:misc-office-misc-w-40665142', 'asset:misc-office-misc-wall-corkboard-02', 'Misc Wall Corkboard 02', 'Wall Decor', [1.7092175199877442, 1.1398402157725118, -6.583785449609415], [0, 0, 0], [1, 0.8, 1]),
  model('asset:misc-office-misc-w-636dbab1', 'asset:misc-office-misc-wall-graph', 'Misc Wall Graph', 'Wall Decor', [-5.481719440267781, 1.0849386917639117, 2.4602429037264066]),
  model('asset:misc-office-misc-w-ed322119', 'asset:misc-office-misc-whiteboard-02', 'Misc Whiteboard 02', 'Wall Decor', [4.090716033972516, 1.425723847362514, -6.699259485409899]),
  model('asset:misc-office-misc-p-e43b6ebc', 'asset:misc-office-misc-pictureframe-01', 'Misc PictureFrame 01', 'Wall Decor', [-6.964568365147489, 2.0103666392438697, -7.512440215127928], [0, 0, 0], [1.1, 1.2, 1]),
  model('/models/3D_Office_Obj_As-d99e0328', chairWhiteAsset, 'Office chair (printer)', 'Seating', [4.5332409408106695, 0.015119386289548009, -2.859694995878368], [0, -1.2656462399555384, 0]),
  model('asset:tables-office-tabl-212ebc98', 'asset:tables-office-table-white-2x2-01', 'Table White 2x2 01', 'Tables', [0.9185795821735305, 0.03459639323232988, -6.482302089857136]),
  model('/models/3D_Office_Obj_As-cbc32684', pc01Asset, 'PC monitor 1', 'Electronics', [0.005893806293349346, 1.1376236439276624, -6.364425963793753], [0, 1.5452768170337088, 0]),
  model('asset:tables-office-tabl-c8783e83', 'asset:tables-office-table-white-2x1-02', 'Table White 2x1 02', 'Tables', [0.14933069874421534, -0.04009292977525192, -2.861084881355804], [-3.141592653589793, 1.55, -3.141592653589793]),
  model('/models/3D_Office_Obj_As-e77976fa', pc01Asset, 'PC monitor 1', 'Electronics', [0.006266483460382943, 1.0668869055225765, -2.815079322182201], [-3.141592653589793, 1.5293970863065336, -3.141592653589793]),
  model('/models/3D_Office_Obj_As-3f582354', chairWhiteAsset, 'Office chair (printer)', 'Seating', [1.5354703984588234, 0, -2.7582100971546417], [0, -0.497970238407739, 0]),
  model('/models/3D_Office_Obj_As-27f5851f', pathAsset(`${A}/Misc/Office_Misc_Organizer.obj`, `${A}/Misc/Office_Misc_Organizer.mtl`), 'Organizer', 'Utilities', [-4.01932822236555, 1.122070402827808, 2.0664456067767887], [0, 0, 0], [0.7, 0.7, 0.7]),
  model('asset:misc-office-misc-n-4d9c7a90', 'asset:misc-office-misc-notebook', 'Misc Notebook', 'Utilities', [-2.761381017321632, 1.1053437896478617, 2.3216925353098823], [0, 0.1790917561102608, 0], [0.8, 0.8, 0.8]),
  model('/models/3D_Office_Obj_As-2003a497', whiteboardAsset, 'Whiteboard', 'Wall Decor', [0.8138474504734168, 1.2059720860564345, -3.462847103322137], [0, 0, 0], [0.5, 0.5, 1]),
  model('asset:misc-trashcans-off-ad2d51bd', 'asset:misc-trashcans-office-misc-trashcan-small-03', 'Misc Trashcan Small 03', 'Utilities', [4.246542845622178, 0, 4.074911630019967]),
  model('/models/3D_Office_Obj_As-77512508', couchWhiteAsset, 'White lounge couch', 'Seating', [-6.672944103318434, 0, -3.8760230675015523], [-0.08086056656958651, -1.5432344646461018, -0.0787707374768924]),
  model('/models/3D_Office_Obj_As-706c1d72', mugAsset, 'Coffee mug copy', 'Coffee', [6.721783507391322, 1.1372846696864132, 3.866652898935706], [-3.141592653589793, 0.6158223036495029, -3.141592653589793]),
  model('/models/3D_Office_Obj_As-b9d000e2', pathAsset(`${A}/Misc/Office_Misc_Plant_01.obj`, `${A}/Misc/Office_Misc_Plant_01.mtl`), 'Plant near door', 'Plants', [-0.3165203273051733, 1.08500886081314, -3.821666025102588], [0, 0, 0], [0.65, 0.65, 0.65]),
  model('/models/3D_Office_Obj_As-9945b03c', plant03Asset, 'Lounge plant', 'Plants', [5.075160550420097, 0, -7.1907645128534465], [0, 0, 0], [0.55, 0.55, 0.55]),
]
