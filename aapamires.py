"""
_Collection of helper functions for Aapa mire classification data retrieval and postprocessing_
"""

import json
import pandas as pd
import os
import configparser
from sentinelhub import SHConfig, parse_time

def cloudmask_calculations():
    """
    evalscript-dependent statistics definitions for cloud mask data
    """
    return  {
                "default": {
                    "statistics": {
                        "default": {
                            "percentiles": {
                                "k": [25,50,75]
                                }
                            }
                        }
                    }
            }

def statistics_calculations():
    """
    evalscript-dependent statistics definitions for classification data
    """
    return  {
                "CL2": {
                    "histograms": {
                            "default": {
                                "nBins": 7,
                                "lowEdge": 1,
                                "highEdge": 8
                                }
                            }
                    },
                "CL3": {
                    "histograms": {    
                            "default": {
                                "nBins": 5,
                                "lowEdge": 1,
                                "highEdge": 6
                                }           
                            }
                },
                "scl": {
                    "histograms": {
                        "default": {
                            "nBins": 12,
                            "lowEdge": 0,
                            "highEdge": 12
                            }
                        }
                    },
                "B11": {
                    "statistics": {
                        "default": {
                            "percentiles": {
                                "k": [1,5,25,50,75,95,99]
                                }
                            }
                        }
                    },
                "B12": {
                    "statistics": {
                        "default": {
                            "percentiles": {
                                "k": [1,5,25,50,75,95,99]
                                }
                            }
                        }
                    }
            }


def setproxies():
    """ Import and apply proxy settings from work directory """
    proxysettings = 'proxies.ini'
    if os.path.exists(proxysettings):
        config = configparser.ConfigParser()
        config.read(proxysettings)
        if config['PROXIES']['HTTP_PROXY']:
            os.environ['HTTP_PROXY'] = config['PROXIES']['HTTP_PROXY']
        if config['PROXIES']['HTTPS_PROXY']:
            os.environ['HTTPS_PROXY'] = config['PROXIES']['HTTPS_PROXY']

def import_sh_config(config_file):
    """
    Read configuration from local file and set SHconfig attributes accordinly. 
    
    By default SHConfig gets values from json in module folder
    """
    config = SHConfig()
    with open(config_file, 'r') as fin:
        sh_conf = json.load(fin)
    for k in sh_conf.keys():
        setattr(config, k, sh_conf[k])
    return config



def stats_to_df(stats_data):
    """   
     Transform Batch Statistical API response into a pandas.DataFrame. 

     NOTE: Removes the default band name 'B0' from the results
    """
    df_data = []
    
    for single_data in stats_data['data']:
        df_entry = {}
        is_valid_entry = True

        df_entry['interval_from'] = parse_time(single_data['interval']['from']).date()
        df_entry['interval_to'] = parse_time(single_data['interval']['to']).date()

        for output_name, output_data in single_data['outputs'].items():
            for band_name, band_values in output_data['bands'].items():

                band_stats = band_values['stats']

                # Skip if all pixels are no-data!
                if band_stats['sampleCount'] == band_stats['noDataCount']:
                    is_valid_entry = False
                    break

                for stat_name, value in band_stats.items():
                    col_name = f'{output_name}_{band_name}_{stat_name}'
                    col_name = col_name.replace('B0_','')

                    if stat_name == 'percentiles':
                        for perc, perc_val in value.items():
                            perc_col_name = f'{col_name}_{perc}'
                            df_entry[perc_col_name] = perc_val
                    else:
                        df_entry[col_name] = value

                if 'histogram' in band_values.keys():
                    band_hist = band_values['histogram']
                    for bin in band_hist['bins']:
                        col_name = f'{output_name}_class_'+str(bin['lowEdge'])
                        df_entry[col_name] = bin['count']

            
        if is_valid_entry:
            df_data.append(df_entry)
        
    return pd.DataFrame(df_data)


def sumi_batch_response_to_df(sumi_batch_result):
    """
    Preprocess SUMI results: Compute percentages and rename variables
    """
    polygon_stats = sumi_batch_result['response']
    df = stats_to_df(polygon_stats)
    if df.empty:
        print('Tried to import empty result!')
        return None
    df['identifier'] = sumi_batch_result['identifier']
    df['date'] = pd.to_datetime(df['interval_from'])
    # NOTE: API does not provide pixel count within the polygon but within it's boundingbox  
    #       Here we assume that there is at least one completely cloud-free observation
    #       so use with caution if temporal window is small! 
    pixelsOutsidePolygon = min(df.B11_noDataCount)
    pixelsInPolygon = max(df.B11_sampleCount)-pixelsOutsidePolygon
    noDataPixelsInPolygon = df.B11_noDataCount-pixelsOutsidePolygon
    dataPixelsInPolygon = pixelsInPolygon - noDataPixelsInPolygon
    maskedPixelPercentage = noDataPixelsInPolygon/pixelsInPolygon*100
    # Assign new columns, these two will be constans
    df['pixelsInPolygon'] = pixelsInPolygon  
    df['cloudcoverage'] = maskedPixelPercentage
    # Rename from evalscript to variable names used in the classifier graphs
    df['A_KUIVA1'] = df['CL2_class_1']/dataPixelsInPolygon*100
    df['A_KUIVA2'] = df['CL2_class_2']/dataPixelsInPolygon*100
    df['A_KUIVA3'] = df['CL2_class_3']/dataPixelsInPolygon*100
    df['A_KUIVA4'] = df['CL2_class_4']/dataPixelsInPolygon*100
    df['A_VESI1'] = df['CL2_class_5']/dataPixelsInPolygon*100
    df['A_VESI2'] = df['CL2_class_6']/dataPixelsInPolygon*100
    df['A_VESI3'] = df['CL2_class_7']/dataPixelsInPolygon*100
    
    df['B_KUIVA1'] = df['CL3_class_1']/dataPixelsInPolygon*100
    df['B_KUIVA2'] = df['CL3_class_2']/dataPixelsInPolygon*100
    df['B_VPKASVI1'] = df['CL3_class_3']/dataPixelsInPolygon*100
    df['B_VPKASVI2'] = df['CL3_class_4']/dataPixelsInPolygon*100
    df['B_AVOVESI1'] = df['CL3_class_5']/dataPixelsInPolygon*100
    
    df['wetpercentage_mod3lk'] = df['B_VPKASVI1'] + df['B_VPKASVI2']
    df['waterpercentage_mod3lk'] = df['B_AVOVESI1']
    df['wetpercentage_mod2lk'] =  df['A_VESI1'] + df['A_VESI2'] + df['A_VESI3']
    df['SWIR1_mean'] = df['B11_mean']
    df['SWIR2_mean'] = df['B12_mean']
    
    return df


def sumi_clouds_response_to_df(sumi_batch_result):
    """
    Preprocess SUMI results: Compute percentages
    """
    polygon_stats = sumi_batch_result['response']
    df = stats_to_df(polygon_stats)
    if df.empty:
        print('Tried to import empty result!')
        return None
    df['identifier'] = sumi_batch_result['identifier']
    df['date'] = pd.to_datetime(df['interval_from'])
    # NOTE: API does not provide pixel count within the polygon but within it's boundingbox  
    #       Here we assume that there is at least one completely cloud-free observation
    #       so use with caution if temporal window is small! 
    pixelsOutsidePolygon = min(df.default_noDataCount)
    pixelsInPolygon = max(df.default_sampleCount)-pixelsOutsidePolygon
    noDataPixelsInPolygon = df.default_noDataCount-pixelsOutsidePolygon
    dataPixelsInPolygon = pixelsInPolygon - noDataPixelsInPolygon
    maskedPixelPercentage = noDataPixelsInPolygon/pixelsInPolygon*100
    # Assign new columns, these two will be constants
    df['pixelsInPolygon'] = pixelsInPolygon  
    df['cloudcoverage'] = maskedPixelPercentage
   
    return df

