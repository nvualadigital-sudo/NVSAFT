import test from "node:test";
import assert from "node:assert/strict";
import {
  CallSounds,
  ringPattern,
} from "../artifacts/lab-results/src/pages/comunicacao/callSounds";

function audio(initial = "suspended", rejectResume = false) {
  const voices: any[] = [],
    gains: any[] = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime(value: number) {
      this.value = value;
    },
  });
  const context: any = {
    state: initial,
    currentTime: 1,
    destination: {},
    resume: async () => {
      if (rejectResume) throw new Error("blocked");
      context.state = "running";
    },
    close: async () => {
      context.state = "closed";
    },
    createGain: () => {
      const gain = { gain: parameter(), connect() {}, disconnect() {} };
      gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      const voice = {
        frequency: parameter(),
        type: "",
        startAt: 0,
        stopCount: 0,
        connect() {},
        disconnect() {},
        start(at: number) {
          this.startAt = at;
        },
        stop() {
          this.stopCount++;
        },
      };
      voices.push(voice);
      return voice;
    },
  };
  return { context, voices, gains };
}
test("incoming and outgoing have different periodic patterns with silence between rings", () => {
  const incoming = ringPattern("incoming"),
    outgoing = ringPattern("outgoing");
  assert.notDeepEqual(incoming, outgoing);
  for (const plan of [incoming, outgoing]) {
    assert.ok(plan.tones.length > 0);
    assert.ok(
      Math.max(...plan.tones.map((t) => t.at + t.duration)) < plan.period,
    );
    assert.ok(
      plan.tones.every(
        (t) => t.duration > 0 && t.frequencies.every((f) => f > 0),
      ),
    );
  }
});
test("a blocked audio context never pretends to play and can be unlocked by an explicit gesture", async () => {
  const fake = audio(),
    sound = new CallSounds(() => fake.context);
  sound.start("incoming");
  assert.equal(fake.voices.length, 0);
  assert.equal(sound.ready, false);
  assert.equal(await sound.unlock(), true);
  assert.equal(fake.voices.length, 12);
  const count = fake.voices.length;
  await sound.unlock();
  assert.equal(
    fake.voices.length,
    count,
    "unrelated clicks must not restart an already audible ring",
  );
  sound.stop();
  assert.ok(fake.voices.every((v) => v.stopCount >= 2));
  sound.dispose();
  assert.equal(fake.context.state, "closed");
});
test("muting, switching and stopping terminate scheduled voices; volume is clamped", async () => {
  const fake = audio("running"),
    sound = new CallSounds(() => fake.context);
  await sound.unlock();
  sound.start("outgoing");
  const prior = [...fake.voices];
  sound.setVolume(7);
  assert.equal(fake.gains[0].gain.value, 1);
  sound.setVolume(-4);
  assert.equal(fake.gains[0].gain.value, 0);
  sound.start("incoming");
  assert.ok(prior.every((v) => v.stopCount >= 2));
  sound.stop();
  assert.ok(fake.voices.every((v) => v.stopCount >= 2));
  sound.dispose();
});
test("permission failure returns a blocked state without crashing or starting oscillators", async () => {
  const fake = audio("suspended", true),
    sound = new CallSounds(() => fake.context);
  sound.start("incoming");
  assert.equal(await sound.unlock(), false);
  assert.equal(fake.voices.length, 0);
  sound.dispose();
});

test("telephone ringing repeats beyond two seconds and stops only when the call is stopped", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const fake = audio("running"),
    sound = new CallSounds(() => fake.context);
  await sound.unlock();
  sound.start("outgoing");
  assert.equal(fake.voices.length, 2);
  t.mock.timers.tick(5000);
  assert.equal(fake.voices.length, 4);
  t.mock.timers.tick(5000);
  assert.equal(fake.voices.length, 6);
  sound.stop();
  const count = fake.voices.length;
  t.mock.timers.tick(20000);
  assert.equal(fake.voices.length, count);
  sound.dispose();
});
test("the 12 second preview repeats and a real call cannot be cut off by the preview timer", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const fake = audio("running"),
    sound = new CallSounds(() => fake.context);
  await sound.unlock();
  sound.preview();
  assert.equal(fake.voices.length, 12);
  t.mock.timers.tick(3200);
  assert.equal(fake.voices.length, 24);
  sound.start("outgoing");
  const count = fake.voices.length;
  t.mock.timers.tick(12000);
  assert.ok(fake.voices.length > count);
  const after = fake.voices.length;
  t.mock.timers.tick(5000);
  assert.ok(fake.voices.length > after);
  sound.stop();
  sound.preview();
  sound.stopPreview();
  const stopped = fake.voices.length;
  t.mock.timers.tick(20000);
  assert.equal(fake.voices.length, stopped);
  sound.dispose();
});
