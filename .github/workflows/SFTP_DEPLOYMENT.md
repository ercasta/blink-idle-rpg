# SFTP Deployment Workflow

This document describes how to configure and use the SFTP deployment workflow for publishing the Blink Idle RPG game to a web server.

## Overview

The SFTP deployment workflow (`.github/workflows/deploy-sftp.yml`) automates the process of:
1. Building the BRL compiler
2. Compiling BRL files to IR
3. Creating a deployment package with game demos
4. Uploading the package to an SFTP server

## Required GitHub Secrets

To use this workflow, you must configure the following secrets in your GitHub repository settings:

### Mandatory Secrets

1. **SFTP_HOST**
   - The hostname or IP address of your SFTP server
   - Example: `sftp.example.com` or `192.168.1.100`

2. **SFTP_USERNAME**
   - The username for SFTP authentication
   - Example: `deploy-user`

3. **SFTP_SSH_KEY**
   - SSH private key for authentication (preferred method)
   - Generate with: `ssh-keygen -t rsa -b 4096 -C "deploy@blink-game"`
   - Copy the **private key** content (entire file including BEGIN/END markers)
   - Add the corresponding **public key** to `~/.ssh/authorized_keys` on the SFTP server

### Optional Secrets

4. **SFTP_PORT** (default: 22)
   - The SFTP server port
   - Only needed if using a non-standard port

5. **SFTP_TARGET_FOLDER** (default: `/var/www/html/blink-game`)
   - The default target folder on the SFTP server
   - Used when workflow is triggered automatically (push to main, tags)
   - Can be overridden via manual workflow dispatch

## Alternative Authentication: Password

If you prefer to use password authentication instead of SSH keys:

1. Store the password in a secret named `SFTP_PASSWORD`
2. Modify the workflow file to use `password: ${{ secrets.SFTP_PASSWORD }}` instead of `ssh_private_key`

**Note:** SSH key authentication is more secure and recommended for production deployments.

## How to Configure Secrets

1. Go to your GitHub repository
2. Click on **Settings**
3. Navigate to **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with its name and value
6. Click **Add secret**

## Using the Workflow

### Automatic Deployment

The workflow automatically runs on:
- Push to the `main` branch
- Creation of version tags (e.g., `v1.0.0`)

### Manual Deployment

You can also trigger the deployment manually with a custom target folder:

1. Go to the **Actions** tab in your GitHub repository
2. Select **Deploy to SFTP Server** workflow
3. Click **Run workflow**
4. Enter the target folder path (e.g., `/var/www/html/blink-game-beta`)
5. Click **Run workflow**

## Deployment Package Contents

The deployment package includes:
- `index.html` - Demo launcher page
- `combat-demo.html` - Interactive combat demo
- `rpg-demo.html` - Classic RPG demo
- `blink-engine.bundle.js` - Blink JavaScript engine
- `README.md` - Documentation
- `party-config.bcl.zip` - Example BCL configuration files

## Security Best Practices

1. **Use SSH Keys:** Prefer SSH key authentication over passwords
2. **Limit Key Permissions:** Create a dedicated SSH key for deployment only
3. **Restrict Server Access:** Configure the SFTP user with minimal permissions
4. **Use Firewall Rules:** Restrict SFTP access to GitHub Actions IP ranges if possible
5. **Rotate Keys Regularly:** Update SSH keys periodically
6. **Monitor Deployments:** Review workflow logs for any suspicious activity

## Troubleshooting

### Connection Timeout

If you see connection timeout errors:
- Verify the SFTP_HOST and SFTP_PORT are correct
- Check that GitHub Actions can reach your server (firewall rules)
- Ensure the SSH service is running on the server

### Authentication Failed

If authentication fails:
- Verify the SFTP_USERNAME is correct
- Check that the SFTP_SSH_KEY is the complete private key (including headers)
- Ensure the corresponding public key is in `~/.ssh/authorized_keys` on the server
- Verify the SSH key permissions on the server (should be 600 for `~/.ssh/authorized_keys`)

### Permission Denied on Remote Path

If you see permission errors:
- Verify the target folder exists on the server
- Check that the SFTP user has write permissions to the target folder
- Try using an absolute path for the target folder

### Files Not Uploaded

If files are missing after deployment:
- Check the workflow logs for file copy errors in "Create deployment package" step
- Verify the source files exist in the repository
- Ensure the `deploy-package` directory is created successfully

## Example: Setting Up SSH Key Authentication

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -f ~/.ssh/blink-deploy -C "deploy@blink-game"

# Copy the public key to your server
ssh-copy-id -i ~/.ssh/blink-deploy.pub user@sftp.example.com

# Copy the private key content
cat ~/.ssh/blink-deploy

# Add the entire private key content (including BEGIN/END lines) 
# as SFTP_SSH_KEY secret in GitHub
```

## Support

For issues or questions:
- Check the workflow run logs in the Actions tab
- Review this documentation
- Open an issue in the GitHub repository
