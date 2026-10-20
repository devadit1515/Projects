// Drives the drifting ground mist in the fog shader. Materials opt in with
// withMist(); any that don't still get mist, just without the drift.
export const mistTime = { value: 0 };

export function withMist(material) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.uMistTime = mistTime;
    previous.call(material, shader, renderer);
  };
  return material;
}
