//VERSION=3
// Switch to use same script either for statistics (0) or for eo-browser visualization for 2-step classifier (1) or 3-step classifier (2)
const MODE = 0 // [0,1,2]

// Define index values
// A: 2-phase classification
let A_DRY1 = 1;
let A_DRY2 = 2;
let A_DRY3 = 3;
let A_DRY4 = 4;
let A_WATER1  = 5;
let A_WATER2  = 6;
let A_WATER3  = 7;
// B: 3-phase classification
let B_DRY1 = 1;
let B_DRY2 = 2;
let B_WETVEG1 = 3;
let B_WETVEG2 = 4;
let B_WATER  = 5;



function mndwi12(samples) {
    return index(samples.B03, samples.B12);
}

function mndwi11(samples) {
    return index(samples.B03, samples.B11);
}

function classify_A_2cl(sample)  {
// ternary operator: TEST ? TRUE : FALSE    
// mosaicmod2lk.png
    return  (sample.B11 >= 1396)
            ? (sample.B04 >= 391)
                ? A_DRY1
                : (mndwi12(sample) >= -0.43)
                    ? A_DRY2
                    : (sample.B12>=1496) 
                        ? A_DRY3 
                        : A_WATER1
            : (sample.B8A >= 1817)
                ? (sample.B11 >= 1247)
                    ? A_DRY4
                    : A_WATER2
                : A_WATER3;
}

function classify_B_3cl(sample)  {
    // ternary operator: TEST ? TRUE : FALSE
    // lopulliset_mallit.pdf
    return  (sample.B11 < 1247)
            ? (sample.B04 < 153)
                ? B_WATER
                : B_WETVEG1
            : (sample.B04 < 278)
                ?  (mndwi11(sample)<-0.64)
                    ? B_WETVEG2
                    : B_DRY1
                : B_DRY2;
}

function domasking(samples) {
        // Return 1/0 as dataMask: 1=DATA, 0 NODATA
        CLOUDFREE=[1];
        CLOUD=[0];
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
          // Unclassified (dark grey) // Changed to cloud 20220202, back to cloudfree on 20220208
          case 7: return CLOUDFREE;          
          // Cloud medium probability (grey)
          case 8: return CLOUD;            
          // Cloud high probability (white)
          case 9: return CLOUD;          
          // Thin cirrus (very bright blue)
          case 10: return CLOUD;            
          // Snow or ice (very bright pink)
          case 11: return CLOUD;        
          // default is cloudfree
          default : return CLOUDFREE;  
        }

}

function evaluatePixelForStatisticalAPI(samples) {
    return {
        dataMask: domasking(samples),
        B11: [samples.B11],
        B12: [samples.B12],
        CL2: [classify_A_2cl(samples)],
        CL3: [classify_B_3cl(samples)],
        scl: [samples.SCL]
      }
}

function evaluatePixelForWMS2lk(samples) {
  CL2 = classify_A_2cl(samples)
  colors = [[84, 61, 13],//DRY_1
            [38, 27, 3],//DRY_2
            [92, 45, 7],//DRY_3
            [36, 21, 9],//DRY_4
            [35, 202, 232],//WATER_1
            [35, 104, 232],//WATER_2
            [24, 15, 189]//WATER_3
          ]
  r = colors[CL2-1][0]
  g = colors[CL2-1][1]
  b = colors[CL2-1][2]
  return [r,g,b,domasking(samples)*255]
}

function evaluatePixelForWMS3lk(samples) {
  CL3 = classify_B_3cl(samples)
  colors = [[84, 61, 13],//DRY_1
            [38, 27, 3],//DRY_2
            [53, 252, 3],//WETVEG_1
            [39, 117, 19],//WETVEG_2
            [35, 202, 232]//WATER_1
          ]
  r = colors[CL3-1][0]
  g = colors[CL3-1][1]
  b = colors[CL3-1][2]
  return [r,g,b,domasking(samples)*255]
}

function evaluatePixel(samples) {
  // Usage mode
  switch (MODE) {
    case 0:
      return evaluatePixelForStatisticalAPI(samples);  
    case 1:
      return evaluatePixelForWMS2lk(samples);
    case 2:
      return evaluatePixelForWMS3lk(samples);
  }
}

function setup() {
  // Set output based on usage mode
  input = [{
    bands: [
      "B03",
      "B04",
      "B8A",
      "B11",
      "B12",
      "SCL",
      "CLM",
      "dataMask"
    ],
  units: "DN" 
  }]

  switch (MODE) {
    case 0:
        return {
          input : input,
          output :  [
          {
            id: "B11",
            bands: 1,
            sampleType: "UINT16"
          },
          {
            id: "B12",
            bands: 1,
            sampleType: "UINT16"
          },
          {
            id: "CL2",
            bands: 1,
            sampleType: "UINT8"
          },
          {
            id: "CL3",
            bands: 1,
            sampleType: "UINT8"
          },
          {
            id: "scl",
            bands: 1,
            sampleType: "UINT8"
          },
          {
            id: "dataMask",
            bands: 1
          }]
      }
      case 1:
        return {
          input : input,
          output : { bands: 4, noDataValue: 0, sampleType: "UINT8" }
        }
        case 2:
          return {
            input : input,
            output : { bands: 4, noDataValue: 0, sampleType: "UINT8" }
          }
    }
}
