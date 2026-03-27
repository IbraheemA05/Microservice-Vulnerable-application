---
auto_execution_mode: 2
---
name: Microservices-Vulnerable CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-secure:
    runs-on: ubuntu-latest

    services:
      mongo:
        image: mongo:7.0
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.runCommand({ping: 1})'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    permissions:
      contents: read
      packages: write
      id-token: write #required for cosign

    steps:
      # ------------------------
      # CHECKOUT CODE
      # ------------------------
      - name: Checkout Code
        uses: actions/checkout@v4

      # ------------------------
      # SETUP NODE
      # ------------------------
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22


      # ------------------------
      # SETUP SNYK CLI
      # ------------------------
      - name: Setup Snyk
        uses: snyk/actions/setup@master

      #-------------------------
      # SETUP SYFT CLI
      #-------------------------
      - name: Setup Syft
        uses: anchore/sbom-action@v0.16.0

      #-------------------------
      # AUTH & SETTINGS
      #-------------------------
      - name: Authenticate Snyk
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: snyk auth $SNYK_TOKEN

      # ------------------------
      # SAST (Code Analysis)
      # ------------------------
      - name: Run Snyk SAST (Auth & Settings)
        continue-on-error: true #This is use to ensure the build completes even if there are issues
        run: |
          cd auth && snyk code test --severity-threshold=high
          cd ../setting && snyk code test --severity-threshold=high || echo "Snyk scan found issues in setting"

      # ------------------------
      # SCA (Dependency Scan)
      # ------------------------
      - name: Run Snyk SCA
        continue-on-error: true #This is use to ensure the build completes even if there are issues
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk auth $SNYK_TOKEN

          cd auth && snyk test --severity-threshold=high || echo "Snyk scan found issues in auth"
          cd ..

          cd setting && snyk test --severity-threshold=high || echo "Snyk scan found issues in settings"
          cd ..

          cd upload && snyk test --severity-threshold=high || echo "Snyk scan found issues in upload"
          cd ..

          cd frontend && snyk test --severity-threshold=high || echo "Snyk scan found issues in frontend"
          cd ..

          cd notification && snyk test --severity-threshold=high || echo "Snyk scan found issues in notification"
          cd ..

      - name: SCA Monitoring
        env:
          SNYK_ORG: ${{ secrets.SNYK_ORG }}
        run: |
          cd auth
          snyk monitor --org=$SNYK_ORG --project-name=auth-service
          cd ..

          cd setting
          snyk monitor --org=$SNYK_ORG --project-name=setting-service
          cd ..

      # ------------------------
      # LOGIN TO DOCKER
      # ------------------------
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      # ------------------------
      # BUILD IMAGES
      # ------------------------
      - name: Build Docker Images
        run: |
          docker build -t auth-service:${{ github.sha }} ./auth
          docker build -t settings-service:${{ github.sha }} ./setting
          docker build -t frontend-service:${{ github.sha }} ./frontend
          docker build -t upload-service:${{ github.sha }} ./upload
          docker build -t notification-service:${{ github.sha }} ./notification



      # ------------------------
      # CONTAINER SCANNING
      # ------------------------
      - name: Snyk Container Scan
        continue-on-error: true #This is use to ensure the build completes even if there are issues
        run: |
          snyk container test auth-service:${{ github.sha }} \
          --severity-threshold=high || echo "High impact vulnerability found in auth-service."

          snyk container test settings-service:${{ github.sha }} \
          --severity-threshold=high || echo "High impact vulnerability found in settings-service."

          snyk container test frontend-service:${{ github.sha }} \
          --severity-threshold=high || echo "High impact vulnerability found in frontend-service."

          snyk container test upload-service:${{ github.sha }} \
          --severity-threshold=high || echo "High impact vulnerability found in upload-service."

      - name: Container Monitoring
        env:
          SNYK_ORG: ${{ secrets.SNYK_ORG }}
        run: |
          snyk container monitor auth-service:${{ github.sha }} \
          --org=$SNYK_ORG \
          --project-name=auth-service-image

          snyk container monitor settings-service:${{ github.sha }} \
          --org=$SNYK_ORG \
          --project-name=settings-service-image

      # ------------------------
      # MONITOR (DASHBOARD)
      # ------------------------
      # - name: Send Results to Snyk Dashboard
      #  run: |
      #   snyk monitor --project-name=auth-service
      #    snyk monitor --project-name=settings-service

      #------------------------
      # GENERATE SBOM WITH SYFT
      #------------------------
      - name: Generate SBOM with Syft
        run: |
          syft auth-service:${{ github.sha }} \
            -o cyclonedx-json=auth-service.sbom.json

          syft settings-service:${{ github.sha }} \
            -o cyclonedx-json=settings-service.sbom.json

          syft frontend-service:${{ github.sha }} \
            -o cyclonedx-json=frontend-service.sbom.json

          syft upload-service:${{ github.sha }} \
            -o cyclonedx-json=upload-service.sbom.json

      #------------------------
      # UPLOAD  
      #------------------------
      - name: Upload SBOM to Snyk
        if: always()
        run: |
          snyk sbom test \
          --file=auth-service.sbom.json \
          --project-name=auth-service

          snyk sbom test \
          --file=settings-service.sbom.json \
          --project-name=settings-service

          snyk sbom test \
          --file=frontend-service.sbom.json \
          --project-name=frontend-service

          snyk sbom test \
          --file=upload-service.sbom.json \
          --project-name=upload-service

      - name: Upload SBOM artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sbom-${{ github.sha }}
          path: |
            auth-service.sbom.json
            settings-service.sbom.json
            frontend-service.sbom.json
            upload-service.sbom.json

      #-------------------------
      # COSIGN AND SIGSTORE
      #-------------------------
      - name: Install Cosign
        uses: sigstore/cosign-installer@main
        with:
          cosign-release: "v3.0.3"
      - name: Check Version
        run: cosign version

      - name: Build & Push Image
        run: |
          docker build -t docker.io/${{ secrets.DOCKER_USERNAME  }}/auth-service:${{ github.sha }} ./auth
          docker push docker.io/${{ secrets.DOCKER_USERNAME  }}/auth-service:${{ github.sha }}

      - name: Build & Push Image
        run: |
          docker build -t docker.io/${{ secrets.DOCKER_USERNAME  }}/settings-service:${{ github.sha }} ./setting
          docker push docker.io/${{ secrets.DOCKER_USERNAME  }}/settings-service:${{ github.sha }}

      - name: Add digest to image #Very important because cosign need the digest to sign the image and {{github.sha}} is mutable according to docker tag
        run: |
          AUTH_DIGEST=$(docker inspect \
            --format='{{index .RepoDigests 0}}' \
            docker.io/${{ secrets.DOCKER_USERNAME }}/auth-service:${{ github.sha }})

          SETTINGS_DIGEST=$(docker inspect \
            --format='{{index .RepoDigests 0}}' \
            docker.io/${{ secrets.DOCKER_USERNAME }}/settings-service:${{ github.sha }})

          FRONTEND_DIGEST=$(docker inspect \
            --format='{{index .RepoDigests 0}}' \
            docker.io/${{ secrets.DOCKER_USERNAME }}/frontend-service:${{ github.sha }})

          UPLOAD_DIGEST=$(docker inspect \
            --format='{{index .RepoDigests 0}}' \
            docker.io/${{ secrets.DOCKER_USERNAME }}/upload-service:${{ github.sha }})

          echo "AUTH_DIGEST=$AUTH_DIGEST" >> $GITHUB_ENV #Way github pass data to next step
          echo "SETTINGS_DIGEST=$SETTINGS_DIGEST" >> $GITHUB_ENV
          echo "FRONTEND_DIGEST=$FRONTEND_DIGEST" >> $GITHUB_ENV
          echo "UPLOAD_DIGEST=$UPLOAD_DIGEST" >> $GITHUB_ENV

      - name: Sign Image with consign
        env:
          COSIGN_EXPERIMENTAL: "true" #This is to acknowledge the experimental feature(keyless signing)
        run: |
          cosign sign $AUTH_DIGEST
          cosign sign $SETTINGS_DIGEST
          cosign sign $FRONTEND_DIGEST
          cosign sign $UPLOAD_DIGEST

      - name: Debug digests
        run: |
          echo "Auth digest: $AUTH_DIGEST"
          echo "Settings digest: $SETTINGS_DIGEST"
          echo "Frontend digest: $FRONTEND_DIGEST"
          echo "Upload digest: $UPLOAD_DIGEST"

      - name: Run DB Migrations
        run: |
          node db/migrate.js
        env:
          MONGO_URI: mongodb://mongo:27017
          MONGO_DB_NAME: microservices


      #------------------------------
      # DAST SCANNING
      #------------------------------
      # - name: OWASP ZAP BASELINE SCANNING
      #   uses: zaproxy/action-baseline@v0.14.0
      #   with:
      #     target: ${{}}
      #     token: ${{}}
      #     fail_action: false
      

      #-------------------------------
      # Telegram Configuration
      #-------------------------------

      - name: Send Telegram Notification
        if: always()  # runs even on failure
        run: |
          STATUS="${{ job.status }}"
          REPO="${{ github.repository }}"
          RUN_URL="https://github.com/$REPO/actions/runs/${{ github.run_id }}"
    
          MESSAGE="*CI/CD Report* 🚀
          Repo: $REPO
          Branch: ${{ github.ref_name }}
          Status: $STATUS
          [View Run]($RUN_URL)"

          curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
          -d chat_id="${{ secrets.TELEGRAM_CHAT_ID }}" \
          -d text="$MESSAGE" \
          -d parse_mode="Markdown"

