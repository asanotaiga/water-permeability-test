// グローバルに「world」インスタンスを用意しなければならない
let world = null;

/** LiquidFunの単位はメートル。px換算の数値を設定します。 */
const METER = 100;
/** 時間のステップを設定します。60FPSを示します。 */
const TIME_STEP = 1.0 / 60.0;
/** 速度の計算回数です。回数が多いほど正確になりますが、計算負荷が増えます。 */
const VELOCITY_ITERATIONS = 1;
/** 位置の計算回数です。回数が多いほど正確になりますが、計算負荷が増えます。 */
const POSITION_ITERATIONS = 1;
/** パーティクルのサイズです。 */
const SIZE_PARTICLE = 4;

/** 画面のサイズ(横幅)です。 */
const windowW = window.innerWidth;
/** 画面のサイズ(高さ)です。 */
const windowH = window.innerHeight;
/** DPIです。 */
const dpi = window.devicePixelRatio || 1.0;

/** [Pixi.js] ステージです。 */
let stage;
let app;
/** [Pixi.js] 粒子の表示オブジェクトの配列です。 */
const _pixiParticles = [];
let _isDragging = false;

/** [LiquidFun] パーティクルシステムです。 */
let _b2ParticleSystem;
/** [LiquidFun] マクスジョイントです。 */
let _b2MouseJoint;

/** 端末ごとにパフォーマンスを調整するための変数です。 */
let performanceLevel;
switch (navigator.platform) {
  case "Win32": // Windowsだったら
  case "MacIntel": // OS Xだったら
    performanceLevel = "high";
    break;
  case "iPhone": // iPhoneだったら
  default:
    // その他の端末も
    performanceLevel = "low";
}

// ページが読み込み終わったら初期化する
window.addEventListener("DOMContentLoaded", init);

function init() {
  // 重力の設定
  const gravity = new b2Vec2(0, 10);
  // Box2D(LiquidFun)の世界を作成
  world = new b2World(gravity);

  // グランドの作成
  _b2GroundBody = world.CreateBody(new b2BodyDef());

  // Box2Dのコンテンツを作成
  createPhysicsWalls();
  createPhysicsParticles();

  // Pixiのコンテンツを作成
  createPixiWorld();

  // 定期的に呼び出す関数(エンターフレーム)を設定
  handleTick();

  setupDragEvent();
}

/** LiquidFunの世界で「壁」を生成します。 */
function createPhysicsWalls() {
  const density = 0;

  const bdDef = new b2BodyDef();
  const bobo = world.CreateBody(bdDef);
  // 壁の生成 (地面)
  const wg = new b2PolygonShape();
  wg.SetAsBoxXYCenterAngle(
    windowW / METER / 2, // 幅
    5 / METER, // 高さ
    new b2Vec2(
      windowW / METER / 2, // X座標
      windowH / METER + 0.05
    ), // Y座標
    100
  );
  bobo.CreateFixtureFromShape(wg, density);

  // 壁の生成 (左側)
  const wgl = new b2PolygonShape();
  wgl.SetAsBoxXYCenterAngle(
    5 / METER, // 幅
    windowH / METER / 2, // 高さ
    new b2Vec2(
      -0.05, // X座標
      windowH / METER / 2
    ), // Y座標
    0
  );
  bobo.CreateFixtureFromShape(wgl, density);

  // 壁の生成 (右側)
  const wgr = new b2PolygonShape();
  wgr.SetAsBoxXYCenterAngle(
    5 / METER, // 幅
    windowH / METER / 2, // 高さ
    new b2Vec2(
      windowW / METER + 0.05, // X座標
      windowH / METER / 2
    ), // Y座標
    0
  );
  bobo.CreateFixtureFromShape(wgr, density);
}

/** LiquidFunの世界で「粒子」を生成します。 */
function createPhysicsParticles() {
  // 粒子の作成 (プロパティーの設定)
  const psd = new b2ParticleSystemDef();
  psd.radius = SIZE_PARTICLE / METER; // 粒子の半径
  psd.pressureStrength = 4.0; // Increases pressure in response to compression Smaller values allow more compression
  _b2ParticleSystem = world.CreateParticleSystem(psd);
  // 粒子の発生領域
  const box = new b2PolygonShape();

  const w = performanceLevel === "high" ? 256 : 256;
  const h = performanceLevel === "high" ? 384 : 128;
  box.SetAsBoxXYCenterAngle(
    w / METER, // 幅
    h / METER, // 高さ
    new b2Vec2(
      windowW / 2 / METER, // 発生X座標
      -windowH / 2 / METER
    ), // 発生Y座標
    0
  );
  const particleGroupDef = new b2ParticleGroupDef();
  particleGroupDef.shape = box; // 発生矩形を登録
  _b2ParticleSystem.CreateParticleGroup(particleGroupDef);
}

function createPixiWorld() {
  // Pixiの世界を作成
  app = new PIXI.Application({
    width: windowW,
    height: windowH,
    resolution: dpi,
    autoStart: true,
    resizeTo: window
  });
  document.body.appendChild(app.view);
  stage = app.stage;

  // canvas 要素でグラフィックを作成 (ドローコール削減のため)
  const canvas = document.createElement("canvas");
  canvas.width = SIZE_PARTICLE * 2 * dpi;
  canvas.height = SIZE_PARTICLE * 2 * dpi;
  const ctx = canvas.getContext("2d");
  ctx.arc(
    SIZE_PARTICLE * dpi,
    SIZE_PARTICLE * dpi,
    (SIZE_PARTICLE * dpi) / 2,
    0,
    2 * Math.PI,
    false
  );
  ctx.fillStyle = "white";
  ctx.fill();

  // canvas 要素をテクスチャーに変換
  const texture = PIXI.Texture.from(canvas);

  // パーティクルの作成
  const length = _b2ParticleSystem.GetPositionBuffer().length / 2;
  for (let i = 0; i < length; i++) {
    const shape = new PIXI.Sprite(texture); // シェイプを作成
    shape.scale.set(1 / dpi);
    shape.pivot.x = SIZE_PARTICLE * dpi;
    shape.pivot.y = SIZE_PARTICLE * dpi;

    stage.addChild(shape); // 画面に追加
    _pixiParticles[i] = shape; // 配列に格納
  }
}

/** 時間経過で指出される関数です。 */
function handleTick() {
  // 物理演算エンジンを更新
  world.Step(TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);

  // パーティクルシステムの計算結果を取得
  const particlesPositions = _b2ParticleSystem.GetPositionBuffer();

  // 粒子表現 : 物理演算エンジンとPixiの座標を同期
  for (let i = 0; i < _pixiParticles.length; i++) {
    const shape = _pixiParticles[i]; // 配列から要素を取得
    // LiquidFunの配列から座標を取得
    const xx = particlesPositions[i * 2] * METER;
    const yy = particlesPositions[i * 2 + 1] * METER;
    // 座標を表示パーツに適用
    shape.x = xx;
    shape.y = yy;
  }
  requestAnimationFrame(handleTick);
}

/**
 * マウス座標を取得します。
 * @return b2Vec2 マウス座標のベクター情報です。
 */
function getMouseCoords(point) {
  const p = new b2Vec2(point.x / METER, point.y / METER);
  return p;
}

/**
 * LiquidFun の衝突判定に使うクラスです。
 * @constructor
 */
function QueryCallback(point) {
  this.point = point;
  this.fixture = null;
}
/**@return bool 当たり判定があれば true を返します。 */
QueryCallback.prototype.ReportFixture = function(fixture) {
  const body = fixture.body;
  if (body.GetType() === b2_dynamicBody) {
    const inside = fixture.TestPoint(this.point);
    if (inside) {
      this.fixture = fixture;
      return true;
    }
  }
  return false;
};
