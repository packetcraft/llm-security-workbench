# How to Install npm on macOS

## ✅ **Method 1 (Recommended): Install via Homebrew**

This is the cleanest and most maintainable method for macOS users.

### **Steps**

1. Install Homebrew (if not already installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
    
2. Install Node.js (includes npm):
```bash
brew install node
```
    
3. Verify installation:
```bash
node -v
npm -v
```
    

📌 _Homebrew keeps Node/npm updated easily with_ `brew upgrade node`_._

## 🟦 **Method 2: Install via Node Version Manager (NVM)**

Best if you want to switch between multiple Node versions (common for dev workflows).
Refer: https://nodejs.org/en/download

### **Steps**

1. Install NVM:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

2. Reload your shell:
```bash
source ~/.zshrc
```

3. Install Node (includes npm):
```bash
nvm install --lts
```

4. Verify: 
```bash
node -v
npm -v
```


📌 _NVM is recommended by npm docs for version management._

## 🟩 **Method 3: Install from Node.js Official PKG Installer**

Simple GUI installer.

### **Steps**

1. Go to: https://nodejs.org

2. Download **macOS Installer (.pkg)** → choose **LTS** version.

3. Run the installer → Continue → Agree → Install.

4. Verify:
```bash
node -v
npm -v
```
    

# 🎯 Which method should _you_ use?

|Method|Best For|Pros|Cons|
|---|---|---|---|
|**Homebrew**|Most macOS developers|Easy updates, clean install|Requires Homebrew|
|**NVM**|Developers needing multiple Node versions|Version switching, safest|Slightly more setup|
|**PKG Installer**|Beginners|Simple GUI|Harder to manage versions|

NVM is typically the most flexible and future-proof.

