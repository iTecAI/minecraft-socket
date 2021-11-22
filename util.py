from concurrent import futures
from concurrent.futures.thread import _worker
import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_paper_jars():
    # Get all PaperMC build links (only most recent per version)
    BUILD_URL = 'https://papermc.io/api/v2/projects/paper/version_group/{version}/builds'
    DOWNLOAD_URL = 'https://papermc.io/api/v2/projects/paper/versions/{version}/builds/{build}/downloads/paper-{version}-{build}.jar'
    
    version_groups = requests.get('https://papermc.io/api/v2/projects/paper/').json()['version_groups']
    version_jars = {}
    for g in version_groups:
        builds = requests.get(BUILD_URL.format(version=g)).json()['builds']
        for b in builds:
            version_jars[b['version']] = DOWNLOAD_URL.format(version=b['version'], build=str(b['build']))
    return version_jars

def _get_mcjar(package):
    data = requests.get(package).json()
    return data


def get_mc_jars():
    # Get all vanilla minecraft jar links
    MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json'
    WORKERS = 32

    manifest = requests.get(MANIFEST_URL).json()
    latest_versions = manifest['latest']
    package_jsons = {v['id']: v['url'] for v in manifest['versions']}

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = [executor.submit(_get_mcjar, v) for v in package_jsons.values()]
        results = {}
        for f in as_completed(futures):
            r = f.result()
            try:
                results[r['id'] if r['type'] == 'release' else r['assets']+'['+r['id']+']'] = r['downloads']['server']['url']
            except KeyError:
                pass
    
    return results, latest_versions

def fetch_jarinfo():
    paper_versions = get_paper_jars()
    mc_versions, latest = get_mc_jars()
    return {
        'latest': latest,
        'paper': paper_versions,
        'vanilla': mc_versions
    }

def defaults(dct, defs={}):
    for k, v in defs.items():
        if not k in dct.keys():
            dct[k] = v
    return dct


if __name__ == '__main__':
    #fetch_jarinfo()
    print(get_mc_jars())