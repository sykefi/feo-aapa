//VERSION=3

function domasking(samples) {
  // Return 1/0 as dataMask: 1=DATA, 0 NODATA
  CLOUDFREE = [1];
  CLOUD = [0];
  //no-data as cloud for SUMI-case as we need full coverage
  if (samples.dataMask == 0) {
    return CLOUD;
  }
  // First use the 160m mask
  if (samples.CLM) {
    return CLOUD;
  }
  // If 160 m mask is cloudfree, check relevant L2A-flags
  switch (samples.SCL) {
    // No Data (Missing data) (black)    
    case 0: return CLOUD;
    // Saturated or defective pixel (red)   
    case 1: return CLOUD;
    // Dark features / Shadows (very dark grey)
    case 2: return CLOUDFREE;
    // Cloud shadows (dark brown)
    case 3: return CLOUDFREE;
    // Vegetation (green)
    case 4: return CLOUDFREE;
    // Not-vegetated (dark yellow)
    case 5: return CLOUDFREE;
    // Water (dark and bright) (blue)
    case 6: return CLOUDFREE;
    // Unclassified (dark grey) // Changed to cloud 20220202
    case 7: return CLOUD;
    // Cloud medium probability (grey)
    case 8: return CLOUD;
    // Cloud high probability (white)
    case 9: return CLOUD;
    // Thin cirrus (very bright blue)
    case 10: return CLOUD;
    // Snow or ice (very bright pink)
    case 11: return CLOUD;
    // default is cloudfree
    default: return CLOUDFREE;
  }

}

function evaluatePixel(samples) {
  return {
    dataMask: domasking(samples),
    default: domasking(samples)
  }
}


function setup() {
  return {
    input: [{
      bands: [
        "SCL",
        "CLM",
        "dataMask"
      ],
      units: "DN"
    }],
    output: [
      {
        id: "dataMask",
        bands: 1
      },
      {
        id: "default",
        bands: 1,
        sampleType: "UINT16"
      }]
  }
}