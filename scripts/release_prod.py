#!/usr/bin/env python3
"""
Production release script for Chrono Narrative Engine
Handles cache purging, warming, and Netlify deployment
"""

import os
import sys
import time
import json
import argparse
import requests
from datetime import datetime
from typing import Dict, List, Optional

class ProductionRelease:
    def __init__(self, version: str = None):
        self.version = version or f"v{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.base_url = os.getenv('PROD_BASE_URL', 'https://bravennow.com')
        self.cf_zone_id = os.getenv('CF_ZONE_ID')
        self.cf_api_token = os.getenv('CF_API_TOKEN')
        self.github_token = os.getenv('GITHUB_TOKEN')
        self.github_repo = os.getenv('GITHUB_REPOSITORY', 'Olexan-art/chrono-narrative-engine')
        
    def print_header(self, text: str):
        """Print a header"""
        print(f"\n{'=' * 60}")
        print(f"  {text}")
        print(f"{'=' * 60}\n")
        
    def print_step(self, text: str):
        """Print a step header"""
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] {text}")
        print("-" * 40)
        
    def print_info(self, text: str):
        """Print info message"""
        print(f"  ℹ️  {text}")
        
    def print_success(self, text: str):
        """Print success message"""
        print(f"  ✅ {text}")
        
    def print_error(self, text: str):
        """Print error message"""
        print(f"  ❌ {text}")
        
    def print_warning(self, text: str):
        """Print warning message"""
        print(f"  ⚠️  {text}")

    def purge_cloudflare_cache(self) -> bool:
        """Purge Cloudflare cache"""
        self.print_step("CLOUDFLARE CACHE PURGE")
        
        if not self.cf_zone_id or not self.cf_api_token:
            self.print_warning("Cloudflare credentials not configured")
            return False
            
        try:
            # Purge everything
            response = requests.post(
                f"https://api.cloudflare.com/client/v4/zones/{self.cf_zone_id}/purge_cache",
                headers={
                    "Authorization": f"Bearer {self.cf_api_token}",
                    "Content-Type": "application/json"
                },
                json={"purge_everything": True},
                timeout=30
            )
            
            if response.status_code == 200:
                self.print_success("Cloudflare cache purged")
                return True
            else:
                self.print_error(f"Cache purge failed: {response.status_code}")
                self.print_error(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.print_error(f"Failed to purge cache: {str(e)}")
            return False

    def warm_cache(self, endpoints: List[str] = None) -> bool:
        """Warm cache by requesting key endpoints"""
        self.print_step("CACHE WARMING")
        
        if not endpoints:
            endpoints = [
                "/",
                "/api/news/latest",
                "/api/news/trending",
                "/news",
                "/timeline"
            ]
        
        success_count = 0
        for endpoint in endpoints:
            url = f"{self.base_url}{endpoint}"
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    self.print_success(f"Warmed: {endpoint}")
                    success_count += 1
                else:
                    self.print_warning(f"Failed to warm {endpoint}: {response.status_code}")
            except Exception as e:
                self.print_error(f"Error warming {endpoint}: {str(e)}")
                
        self.print_info(f"Warmed {success_count}/{len(endpoints)} endpoints")
        return success_count > 0

    def trigger_netlify_github_action(self) -> bool:
        """Trigger Netlify deployment via GitHub Actions"""
        self.print_info("Netlify deployment will be triggered automatically by GitHub Actions")
        self.print_info("The auto-release-prod.yml workflow includes Netlify deployment")
        self.print_info("Check GitHub Actions tab for deployment status")
        return True



    def trigger_netlify(self) -> bool:
        """Inform about Netlify deployment via GitHub Actions"""
        self.print_step("NETLIFY DEPLOYMENT")
        return self.trigger_netlify_github_action()

    def run(self) -> bool:
        """Run the full production release"""
        self.print_header(f"PRODUCTION RELEASE {self.version}")
        
        # Step 1: Purge cache
        cache_purged = self.purge_cloudflare_cache()
        
        # Step 2: Warm cache
        cache_warmed = self.warm_cache()
        
        # Step 3: Notify about Netlify
        self.trigger_netlify()
        
        # Summary
        self.print_header("RELEASE SUMMARY")
        self.print_info(f"Version: {self.version}")
        self.print_info(f"Cache purged: {'✅' if cache_purged else '❌'}")
        self.print_info(f"Cache warmed: {'✅' if cache_warmed else '❌'}")
        self.print_info("Netlify: Will deploy automatically via GitHub Actions")
        
        if cache_purged or cache_warmed:
            self.print_success("\n🎉 Production cache operations completed!")
            self.print_info("Netlify will be deployed automatically via GitHub Actions")
            self.print_info("Check the Actions tab for deployment progress")
            return True
        else:
            self.print_error("\n⚠️  Release completed with issues")
            return False


def main():
    parser = argparse.ArgumentParser(description='Production release script')
    parser.add_argument('--version', help='Version tag for the release')
    parser.add_argument('--skip-cache', action='store_true', help='Skip cache operations')
    parser.add_argument('--endpoints', nargs='+', help='Additional endpoints to warm')
    
    args = parser.parse_args()
    
    release = ProductionRelease(version=args.version)
    
    if args.skip_cache:
        # Just trigger Netlify
        success = release.trigger_netlify()
    else:
        # Full release
        success = release.run()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()