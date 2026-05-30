class Condition {
  constructor() {
    this.parameter = "";
    this.operator = ">";
    this.value = 0;
  }

  setParameter(parameter) {
    this.parameter = parameter;
  }

  setOperator(operator) {
    this.operator = operator;
  }

  setValue(value) {
    this.value = value;
  }
}

class Transition {
  constructor() {
    this.nextState = null; // 次のステート
    this.transitionDuration = 0; // 何秒かけて遷移するか
    this.exitTime = 0;
    /** @type {Condition[]} */
    this.conditions = []; // 条件
  }

  createCondition() {
    return new Condition();
  }

  setNextState(nextState) {
    this.nextState = nextState;
  }

  setTransitionDuration(transitionDuration) {
    this.transitionDuration = transitionDuration;
  }

  setExitTime(exitTime) {
    this.exitTime = exitTime;
  }

  addCondition(condition) {
    if (condition instanceof Condition) this.conditions.push(condition);
    else console.error("値はConditionである必要があります", condition);
  }
}

class BoneAnimation {
  constructor() {
    this.positionCurve = [];
    this.rotationCurve = [];
    this.scaleCurve = [];
  }

  setPositionCurve(positionCurve) {
    this.positionCurve = positionCurve;
  }

  setRotationCurve(rotationCurve) {
    this.rotationCurve = rotationCurve;
  }

  setScaleCurve(scaleCurve) {
    this.scaleCurve = scaleCurve;
  }
}

class BoneAnimatoinBlock {
  constructor() {
    this.boneIndex = 0;
    this.animation = new BoneAnimation();
  }
}

class AnimationClip {
  constructor() {
    /** @type {BoneAnimatoinBlock[]} */
    this.animationData = [];
  }

  setAnimationData(animationData) {
    this.animationData = animationData;
  }
}

export class AnimationState {
  constructor() {
    /** @type {AnimationClip} */
    this.animatinoClip = null;
    this.startTime = 0;
    this.endTime = 0;
    this.loopTime = false; // ループするか
    this.cycleOffset = 0; // ループ後の再生開始位置 0 ~ 1
    /** @type {Transition[]} */
    this.transitions = []; // そのステートから行けるステートへ
  }

  setCycleOffset(cycleOffset) {
    this.cycleOffset = cycleOffset;
  }

  setLoopTime(loopTime) {
    this.loopTime = loopTime;
  }

  createAnimationClip() {
    return new AnimationClip();
  }

  setAnimatinoClip(animatinoClip) {
    this.animatinoClip = animatinoClip;
  }

  setStartTime(startTime) {
    this.startTime = startTime;
  }

  setEndTime(endTime) {
    this.endTime = endTime;
  }

  addTransition(transition) {
    if (transition instanceof Transition) this.transitions.push(transition);
    else console.error("値はTransitionである必要があります", transition);
  }
}

class StateMachine {
  constructor() {
    /** @type {Map<String,AnimationState>} */
    this.states = new Map();
    /** @type {Transition[]} */
    this.transitions = { entry: [], any: [] }; // entryやanyなど特別なステートへ
  }

  createState() {
    return new AnimationState();
  }

  createTransition() {
    return new Transition();
  }

  addStates(stateName, state) {
    this.states.set(stateName, state);
  }

  addTransition(target, transition) {
    if (transition instanceof Transition)
      this.transitions[target].push(transition);
    else console.error("値はTransitionである必要があります", transition);
  }
}

export class AnimatorController {
  constructor() {
    this.parameters = [];
    /** @type {StateMachine[]} */
    this.layers = [];
  }

  createStateMachine() {
    return new StateMachine();
  }

  addParameter(parameterName) {
    this.parameters.push(parameterName);
  }

  addLayer(stateMachine) {
    this.layers.push(stateMachine);
  }
}

export class AnimatorControllerManager {
  constructor() {
    this.name = "AnimatorControllerManager";
    /** @type {Map<String, AnimatorController>} */
    this.animatorControllers = new Map();
  }

  createAnimatorController() {
    return new AnimatorController();
  }

  getAnimatorControllerById(id) {
    const animatorController = this.animatorControllers.get(id);
    if (animatorController) return animatorController;
    else return null;
  }

  addAnimatorController(id, animatorController) {
    this.animatorControllers.set(id, animatorController);
    return id;
  }
}
