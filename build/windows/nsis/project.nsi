Unicode true

####
## Please note: Template replacements don't work in this file. They are provided with default defines like
## mentioned underneath.
## If the keyword is not defined, "wails_tools.nsh" will populate them.
## If they are defined here, "wails_tools.nsh" will not touch them. This allows you to use this project.nsi manually
## from outside of Wails for debugging and development of the installer.
## 
## For development first make a wails nsis build to populate the "wails_tools.nsh":
## > wails build --target windows/amd64 --nsis
## Then you can call makensis on this file with specifying the path to your binary:
## For a AMD64 only installer:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app.exe
## For a ARM64 only installer:
## > makensis -DARG_WAILS_ARM64_BINARY=..\..\bin\app.exe
## For a installer with both architectures:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app-amd64.exe -DARG_WAILS_ARM64_BINARY=..\..\bin\app-arm64.exe
####
## The following information is taken from the wails_tools.nsh file, but they can be overwritten here.
####
## !define INFO_PROJECTNAME    "my-project" # Default "filament_tracker"
## !define INFO_COMPANYNAME    "My Company" # Default "My Company"
## !define INFO_PRODUCTNAME    "My Product Name" # Default "My Product"
## !define INFO_PRODUCTVERSION "1.0.0"     # Default "0.1.0"
## !define INFO_COPYRIGHT      "(c) Now, My Company" # Default "© 2026, My Company"
###
## !define PRODUCT_EXECUTABLE  "Application.exe"      # Default "${INFO_PROJECTNAME}.exe"
## !define UNINST_KEY_NAME     "UninstKeyInRegistry"  # Default "${INFO_COMPANYNAME}${INFO_PRODUCTNAME}"
####
!define REQUEST_EXECUTION_LEVEL "admin"            # Default "admin"  see also https://nsis.sourceforge.io/Docs/Chapter4.html
####
## Include the wails tools
####
!include "wails_tools.nsh"

# The version information for this two must consist of 4 parts (Major.Minor.Patch.Build)
VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion    "${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"     "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion"  "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"     "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"  "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"     "${INFO_PRODUCTNAME}"

# Enable HiDPI support. https://nsis.sourceforge.io/Reference/ManifestDPIAware
ManifestDPIAware true

!include "MUI.nsh"

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
# !define MUI_WELCOMEFINISHPAGE_BITMAP "resources\leftimage.bmp" #Include this to add a bitmap on the left side of the Welcome Page. Must be a size of 164x314
!define MUI_FINISHPAGE_NOAUTOCLOSE # Wait on the INSTFILES page so the user can take a look into the details of the installation steps
!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.

## Upgrade detection
## $IsUpgrade is set in .onInit by checking whether an InstallLocation registry value already exists.
##   "1" = a previous installation was found  - treat this run as an upgrade
##   "0" = no previous installation found     - treat this run as a fresh install
Var IsUpgrade

Function SkipDirIfUpgrade
    ${If} $IsUpgrade == "1"
        Abort ; skips the directory page
    ${EndIf}
FunctionEnd

## Finish page - "Launch app" checkbox
## MUI_FINISHPAGE_RUN_FUNCTION points to LaunchApp below instead of running the exe directly.
## This lets us guard the launch with a FileExists check, and keeps the logic in one place.
## The checkbox is shown on both fresh installs and upgrades.
!define MUI_FINISHPAGE_RUN                        # Enable the run-app checkbox on the Finish page
!define MUI_FINISHPAGE_RUN_TEXT   "Launch ${INFO_PRODUCTNAME}"  # Checkbox label
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"  # Delegate to our function instead of a bare Exec

# Called when the user clicks Finish with the checkbox ticked.
# Runs the app as a normal user even though the installer ran as admin,
# by using explorer.exe as a trampoline (avoids the app inheriting elevated privileges).
Function LaunchApp
    ${If} ${FileExists} "$INSTDIR\${PRODUCT_EXECUTABLE}"
        Exec '"$WINDIR\explorer.exe" "$INSTDIR\${PRODUCT_EXECUTABLE}"'
    ${EndIf}
FunctionEnd

## Installer pages
!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
# !insertmacro MUI_PAGE_LICENSE "resources\eula.txt" # Adds a EULA page to the installer

!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipDirIfUpgrade
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page (skipped on upgrade).

!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_INSTFILES # Uninstalling page

!insertmacro MUI_LANGUAGE "English" # Set the Language of the installer

## The following two statements can be used to sign the installer and the uninstaller. The path to the binaries are provided in %1
#!uninstfinalize 'signtool --file "%1"'
#!finalize 'signtool --file "%1"'

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\..\bin\${INFO_PROJECTNAME}-${ARCH}-installer.exe" # Name of the installer's file.
InstallDir "$PROGRAMFILES64\${INFO_COMPANYNAME}\${INFO_PRODUCTNAME}" # Default installing folder ($PROGRAMFILES is Program Files folder).
ShowInstDetails show # This will always show the installation details.

## Runs before any UI is shown
## Checks the CPU architecture, then looks up any existing installation in the registry.
## If found, the install directory is set to the previous location and $IsUpgrade is set to "1"
## so the Directory page will be skipped. The app is relaunched only if the user ticks
## the "Launch app" checkbox on the Finish page.
Function .onInit
    !insertmacro wails.checkArchitecture

    # Use the 64-bit registry view so we read/write under the correct hive on 64-bit Windows
    SetRegView 64
    ReadRegStr $R0 HKLM "${UNINST_KEY}" "InstallLocation"

    ${If} $R0 != ""
        # A previous installation exists - reuse its directory and mark this as an upgrade
        StrCpy $INSTDIR $R0
        StrCpy $IsUpgrade "1"
    ${Else}
        # No previous installation found - this is a fresh install
        StrCpy $IsUpgrade "0"
    ${EndIf}
FunctionEnd

## Main install section
Section "Install ${INFO_PRODUCTNAME}"

    # If the installer was launched with /PID=<pid>, wait for that process to exit before
    # writing files. This is used when the app relaunches the installer to update itself —
    # the running instance passes its own PID so we don't overwrite files that are still open.
    ${GetParameters} $R0
    ${GetOptions} $R0 "/PID=" $R1
    ${If} $R1 != ""
        DetailPrint "Waiting for ${INFO_PRODUCTNAME} (PID $R1) to exit before installing..."
        System::Call 'kernel32::OpenProcess(i 0x100000, i 0, i R1) i .R2'
        ${If} $R2 != 0
            # Wait up to 30 seconds; if the process doesn't exit in time we proceed anyway
            System::Call 'kernel32::WaitForSingleObject(i R2, i 30000)'
            System::Call 'kernel32::CloseHandle(i R2)'
        ${EndIf}
    ${EndIf}

    !insertmacro wails.setShellContext    # Set shell context to current user or all users depending on privileges
    !insertmacro wails.webview2runtime   # Install WebView2 runtime if not already present

    SetOutPath $INSTDIR

    !insertmacro wails.files             # Extract application files to $INSTDIR

    # Create Start Menu and Desktop shortcuts
    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"

    !insertmacro wails.associateFiles            # Register file type associations (if any defined in wails_tools.nsh)
    !insertmacro wails.associateCustomProtocols  # Register custom URI protocol handlers (if any)
    !insertmacro wails.writeUninstaller          # Write uninstall entry to Add/Remove Programs

    # Persist the install location so future upgrades can find and reuse it
    SetRegView 64
    WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
SectionEnd

Section "uninstall" 
    !insertmacro wails.setShellContext

    # Remove the WebView2 user-data directory created by the app at runtime.
    # This folder is stored under AppData using the executable name as its key.
    RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"

    # Remove all installed application files
    RMDir /r $INSTDIR

    # Remove shortcuts
    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"

    !insertmacro wails.unassociateFiles            # Remove file type associations
    !insertmacro wails.unassociateCustomProtocols  # Remove custom URI protocol handlers
    !insertmacro wails.deleteUninstaller           # Remove uninstall registry entry
SectionEnd
