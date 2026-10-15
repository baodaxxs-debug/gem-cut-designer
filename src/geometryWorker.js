import { buildGemFromDesign } from './gemcad.js'

self.onmessage = event => {
  const { id, design, facetEdits } = event.data
  try {
    self.postMessage({ id, model: buildGemFromDesign(design, facetEdits), error: '' })
  } catch (error) {
    self.postMessage({ id, model: null, error: error.message })
  }
}
