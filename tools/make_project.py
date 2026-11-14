#!/usr/bin/env python3
"""Generates Heli112.xcodeproj (Xcode 16+ synchronized folders): 112Heli (iPhone/iPad + Mac), widgets, Apple TV.

Run again after adding a target or changing build settings; new Swift files in the folders are picked up by Xcode itself.
"""
import hashlib, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = "Heli112.xcodeproj"
BUNDLE = "app.lrvdlinden.112HELI"
TEAM = "EU3UY476T6"


def oid(name):
    return hashlib.md5(("112heli-" + name).encode()).hexdigest()[:24].upper()


def q(v):
    s = str(v)
    if s == "" or any(c in s for c in ' $(),;=-/+:*[]"&@{}<>') and not (s.startswith('"') and s.endswith('"')):
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
    return s


def settings(d, ind="\t\t\t\t"):
    out = []
    for k, v in d.items():
        key = f'"{k}"' if "[" in k else k
        out.append(f"{ind}{key} = {q(v)};")
    return "\n".join(out)


# ------------------------------------------------------------------ build settings
common_proj = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS": "YES",
    "CLANG_ENABLE_MODULES": "YES",
    "CLANG_ENABLE_OBJC_ARC": "YES",
    "ENABLE_STRICT_OBJC_MSGSEND": "YES",
    "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
    "GCC_C_LANGUAGE_STANDARD": "gnu17",
    "LOCALIZATION_PREFERS_STRING_CATALOGS": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "IPHONEOS_DEPLOYMENT_TARGET": "17.0",
    "MACOSX_DEPLOYMENT_TARGET": "14.0",
    "TVOS_DEPLOYMENT_TARGET": "17.0",
    "WATCHOS_DEPLOYMENT_TARGET": "10.0",
    "XROS_DEPLOYMENT_TARGET": "1.0",
}
proj_debug = dict(common_proj, DEBUG_INFORMATION_FORMAT="dwarf", ENABLE_TESTABILITY="YES", GCC_OPTIMIZATION_LEVEL="0",
                  ONLY_ACTIVE_ARCH="YES", SWIFT_ACTIVE_COMPILATION_CONDITIONS="DEBUG $(inherited)", SWIFT_OPTIMIZATION_LEVEL="-Onone")
proj_release = dict(common_proj, DEBUG_INFORMATION_FORMAT="dwarf-with-dsym", ENABLE_NS_ASSERTIONS="NO",
                    SWIFT_COMPILATION_MODE="wholemodule", VALIDATE_PRODUCT="YES")

identity = {
    "CODE_SIGN_STYLE": "Automatic",
    "DEVELOPMENT_TEAM": TEAM,
    "MARKETING_VERSION": "1.0.0",
    "CURRENT_PROJECT_VERSION": "2",
    "GENERATE_INFOPLIST_FILE": "YES",
    "INFOPLIST_KEY_ITSAppUsesNonExemptEncryption": "NO",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
}

app = dict(identity, **{
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_ENTITLEMENTS[sdk=iphoneos*]": "Config/Heli112-iOS.entitlements",
    "CODE_SIGN_ENTITLEMENTS[sdk=iphonesimulator*]": "Config/Heli112-iOS.entitlements",
    "CODE_SIGN_ENTITLEMENTS[sdk=macosx*]": "Config/Heli112-macOS.entitlements",
    "COMBINE_HIDPI_IMAGES": "YES",
    "ENABLE_HARDENED_RUNTIME": "YES",
    "ENABLE_PREVIEWS": "YES",
    "INFOPLIST_FILE": "Config/Heli112-Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "112Heli",
    "INFOPLIST_KEY_LSApplicationCategoryType": "public.app-category.news",
    "INFOPLIST_KEY_NSLocationWhenInUseUsageDescription": "Je locatie wordt gebruikt om te tonen hoe ver een toestel weg is en voor meldingen uit je eigen omgeving (afgerond op ongeveer een kilometer).",
    "INFOPLIST_KEY_NSSupportsLiveActivities": "YES",
    "INFOPLIST_KEY_NSHumanReadableCopyright": "© 112Heli · LRvdLinden",
    "INFOPLIST_KEY_UIApplicationSceneManifest_Generation[sdk=iphoneos*]": "YES",
    "INFOPLIST_KEY_UIApplicationSceneManifest_Generation[sdk=iphonesimulator*]": "YES",
    "INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents[sdk=iphoneos*]": "YES",
    "INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents[sdk=iphonesimulator*]": "YES",
    "INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad": "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight",
    "INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone": "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight",
    "LD_RUNPATH_SEARCH_PATHS[sdk=iphoneos*]": "$(inherited) @executable_path/Frameworks",
    "LD_RUNPATH_SEARCH_PATHS[sdk=iphonesimulator*]": "$(inherited) @executable_path/Frameworks",
    "LD_RUNPATH_SEARCH_PATHS[sdk=macosx*]": "$(inherited) @executable_path/../Frameworks",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE,
    "PRODUCT_MODULE_NAME": "Heli112",
    "PRODUCT_NAME": "112Heli",
    "SDKROOT": "auto",
    "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator macosx",
    "SUPPORTS_MACCATALYST": "NO",
    "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD": "NO",
    "SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD": "NO",
    "TARGETED_DEVICE_FAMILY": "1,2",
})

widget = dict(identity, **{
    "APPLICATION_EXTENSION_API_ONLY": "YES",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME": "WidgetBackground",
    "CODE_SIGN_ENTITLEMENTS[sdk=iphoneos*]": "Config/Widgets-iOS.entitlements",
    "CODE_SIGN_ENTITLEMENTS[sdk=iphonesimulator*]": "Config/Widgets-iOS.entitlements",
    "CODE_SIGN_ENTITLEMENTS[sdk=macosx*]": "Config/Widgets-macOS.entitlements",
    "ENABLE_HARDENED_RUNTIME": "YES",
    "INFOPLIST_FILE": "Config/Widgets-Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "112Heli",
    "INFOPLIST_KEY_LSApplicationCategoryType": "public.app-category.news",
    "LD_RUNPATH_SEARCH_PATHS[sdk=iphoneos*]": "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
    "LD_RUNPATH_SEARCH_PATHS[sdk=iphonesimulator*]": "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
    "LD_RUNPATH_SEARCH_PATHS[sdk=macosx*]": "$(inherited) @executable_path/../Frameworks @executable_path/../../../../Frameworks",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE + ".widgets",
    "PRODUCT_MODULE_NAME": "Heli112Widgets",
    "PRODUCT_NAME": "112Heli Widgets",
    "SDKROOT": "auto",
    "SKIP_INSTALL": "YES",
    "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator macosx",
    "SUPPORTS_MACCATALYST": "NO",
    "TARGETED_DEVICE_FAMILY": "1,2",
})

tv = dict(identity, **{
    "ASSETCATALOG_COMPILER_APPICON_NAME": "App Icon & Top Shelf Image",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_ENTITLEMENTS": "Config/Heli112TV.entitlements",
    "ENABLE_PREVIEWS": "YES",
    "INFOPLIST_FILE": "Config/Heli112TV-Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "112Heli",
    "INFOPLIST_KEY_LSApplicationCategoryType": "public.app-category.news",
    "INFOPLIST_KEY_UIUserInterfaceStyle": "Automatic",
    "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks",
    # Same bundle ID as the iPhone/iPad/Mac app: one App Store record (universal purchase).
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE,
    "PRODUCT_MODULE_NAME": "Heli112TV",
    "PRODUCT_NAME": "112Heli TV",
    "SDKROOT": "appletvos",
    "SUPPORTED_PLATFORMS": "appletvos appletvsimulator",
    "TARGETED_DEVICE_FAMILY": "3",
})

# ------------------------------------------------------------------ targets
TARGETS = [
    # key, name, product file, product type, folders, settings
    ("app", "112Heli", "112Heli.app", "com.apple.product-type.application", ["Heli112", "Shared", "SharedUI"], app),
    ("widget", "112Heli Widgets", "112Heli Widgets.appex", "com.apple.product-type.app-extension", ["Heli112Widgets", "Shared"], widget),
    ("tv", "112Heli TV", "112Heli TV.app", "com.apple.product-type.application", ["Heli112TV", "Shared", "SharedUI"], tv),
]
FOLDERS = ["Heli112", "Heli112Widgets", "Heli112TV", "Shared", "SharedUI"]
CONFIG_FILES = sorted(os.listdir(os.path.join(root, "Config")))
I = {k: oid(k) for k in ["project", "main", "products", "config", "projList", "projDebug", "projRelease",
                          "embedExt", "bfWidget", "depWidget", "proxyWidget"]}
for f in FOLDERS:
    I["grp" + f] = oid("grp" + f)
for t in TARGETS:
    for part in ["target", "product", "sources", "resources", "frameworks", "list", "debug", "release"]:
        I[t[0] + part] = oid(t[0] + part)
cfg = {f: oid("cfg-" + f) for f in CONFIG_FILES}
BASE = cfg["Base.xcconfig"]


def ftype(f):
    ext = f.rsplit(".", 1)[1]
    return {"xcconfig": "text.xcconfig", "plist": "text.plist.xml", "entitlements": "text.plist.entitlements"}.get(ext, "text")


def xcconf(key, name, d, base=None):
    b = f"\t\t\tbaseConfigurationReference = {base} /* Base.xcconfig */;\n" if base else ""
    return f"\t\t{key} /* {name} */ = {{\n\t\t\tisa = XCBuildConfiguration;\n{b}\t\t\tbuildSettings = {{\n{settings(d)}\n\t\t\t}};\n\t\t\tname = {name};\n\t\t}};\n"


def phase(key, isa, name):
    return f"\t\t{key} /* {name} */ = {{\n\t\t\tisa = {isa};\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"


def conflist(key, comment, debug, release):
    return (f"\t\t{key} /* {comment} */ = {{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n"
            f"\t\t\t\t{debug} /* Debug */,\n\t\t\t\t{release} /* Release */,\n\t\t\t);\n"
            f"\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t}};\n")


native = ""
for k, name, prod, ptype, folders, _ in TARGETS:
    extra_phases = f"\t\t\t\t{I['embedExt']} /* Embed Foundation Extensions */,\n" if k == "app" else ""
    deps = f"\t\t\t\t{I['depWidget']} /* PBXTargetDependency */,\n" if k == "app" else ""
    groups = "".join(f"\t\t\t\t{I['grp' + f]} /* {f} */,\n" for f in folders)
    native += (f"\t\t{I[k + 'target']} /* {name} */ = {{\n\t\t\tisa = PBXNativeTarget;\n"
               f"\t\t\tbuildConfigurationList = {I[k + 'list']} /* Build configuration list for PBXNativeTarget \"{name}\" */;\n"
               f"\t\t\tbuildPhases = (\n\t\t\t\t{I[k + 'sources']} /* Sources */,\n\t\t\t\t{I[k + 'frameworks']} /* Frameworks */,\n"
               f"\t\t\t\t{I[k + 'resources']} /* Resources */,\n{extra_phases}\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n"
               f"\t\t\tdependencies = (\n{deps}\t\t\t);\n\t\t\tfileSystemSynchronizedGroups = (\n{groups}\t\t\t);\n"
               f"\t\t\tname = \"{name}\";\n\t\t\tpackageProductDependencies = (\n\t\t\t);\n\t\t\tproductName = \"{name}\";\n"
               f"\t\t\tproductReference = {I[k + 'product']} /* {prod} */;\n\t\t\tproductType = \"{ptype}\";\n\t\t}};\n")

file_refs = "".join(
    f"\t\t{I[k + 'product']} /* {prod} */ = {{isa = PBXFileReference; explicitFileType = {'\"wrapper.app-extension\"' if prod.endswith('appex') else 'wrapper.application'}; includeInIndex = 0; path = \"{prod}\"; sourceTree = BUILT_PRODUCTS_DIR; }};\n"
    for k, _, prod, *_ in TARGETS)
file_refs += "".join(f"\t\t{cfg[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = {ftype(f)}; path = \"{f}\"; sourceTree = \"<group>\"; }};\n" for f in CONFIG_FILES)

sync_groups = "".join(f"\t\t{I['grp' + f]} /* {f} */ = {{isa = PBXFileSystemSynchronizedRootGroup; path = {f}; sourceTree = \"<group>\"; }};\n" for f in FOLDERS)

phases_fw = "".join(phase(I[k + "frameworks"], "PBXFrameworksBuildPhase", "Frameworks") for k, *_ in TARGETS)
phases_res = "".join(phase(I[k + "resources"], "PBXResourcesBuildPhase", "Resources") for k, *_ in TARGETS)
phases_src = "".join(phase(I[k + "sources"], "PBXSourcesBuildPhase", "Sources") for k, *_ in TARGETS)

configs = xcconf(I["projDebug"], "Debug", proj_debug, BASE) + xcconf(I["projRelease"], "Release", proj_release, BASE)
lists = conflist(I["projList"], 'Build configuration list for PBXProject "Heli112"', I["projDebug"], I["projRelease"])
for k, name, _, _, _, s in TARGETS:
    configs += xcconf(I[k + "debug"], "Debug", s) + xcconf(I[k + "release"], "Release", s)
    lists += conflist(I[k + "list"], f'Build configuration list for PBXNativeTarget "{name}"', I[k + "debug"], I[k + "release"])

target_attrs = "".join(f"\t\t\t\t\t{I[k + 'target']} = {{\n\t\t\t\t\t\tCreatedOnToolsVersion = 26.0;\n\t\t\t\t\t}};\n" for k, *_ in TARGETS)
target_list = "".join(f"\t\t\t\t{I[k + 'target']} /* {name} */,\n" for k, name, *_ in TARGETS)
products = "".join(f"\t\t\t\t{I[k + 'product']} /* {prod} */,\n" for k, _, prod, *_ in TARGETS)
main_children = "".join(f"\t\t\t\t{I['grp' + f]} /* {f} */,\n" for f in FOLDERS)
cfg_children = "".join(f"\t\t\t\t{cfg[f]} /* {f} */,\n" for f in CONFIG_FILES)

pbx = f"""// !$*UTF8*$!
{{
\tarchiveVersion = 1;
\tclasses = {{
\t}};
\tobjectVersion = 77;
\tobjects = {{

/* Begin PBXBuildFile section */
\t\t{I['bfWidget']} /* 112Heli Widgets.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {I['widgetproduct']} /* 112Heli Widgets.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};
/* End PBXBuildFile section */

/* Begin PBXContainerItemProxy section */
\t\t{I['proxyWidget']} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = {I['project']} /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {I['widgettarget']};
\t\t\tremoteInfo = "112Heli Widgets";
\t\t}};
/* End PBXContainerItemProxy section */

/* Begin PBXCopyFilesBuildPhase section */
\t\t{I['embedExt']} /* Embed Foundation Extensions */ = {{
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t{I['bfWidget']} /* 112Heli Widgets.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXCopyFilesBuildPhase section */

/* Begin PBXFileReference section */
{file_refs}/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
{sync_groups}/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
{phases_fw}/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
\t\t{I['main']} = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
{main_children}\t\t\t\t{I['config']} /* Config */,
\t\t\t\t{I['products']} /* Products */,
\t\t\t);
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{I['config']} /* Config */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
{cfg_children}\t\t\t);
\t\t\tpath = Config;
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{I['products']} /* Products */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
{products}\t\t\t);
\t\t\tname = Products;
\t\t\tsourceTree = "<group>";
\t\t}};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
{native}/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\t{I['project']} /* Project object */ = {{
\t\t\tisa = PBXProject;
\t\t\tattributes = {{
\t\t\t\tBuildIndependentTargetsInParallel = 1;
\t\t\t\tLastSwiftUpdateCheck = 2600;
\t\t\t\tLastUpgradeCheck = 2600;
\t\t\t\tTargetAttributes = {{
{target_attrs}\t\t\t\t}};
\t\t\t}};
\t\t\tbuildConfigurationList = {I['projList']} /* Build configuration list for PBXProject "Heli112" */;
\t\t\tdevelopmentRegion = nl;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\tnl,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = {I['main']};
\t\t\tminimizedProjectReferenceProxies = 1;
\t\t\tpreferredProjectObjectVersion = 77;
\t\t\tproductRefGroup = {I['products']} /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
{target_list}\t\t\t);
\t\t}};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
{phases_res}/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
{phases_src}/* End PBXSourcesBuildPhase section */

/* Begin PBXTargetDependency section */
\t\t{I['depWidget']} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {I['widgettarget']} /* 112Heli Widgets */;
\t\t\ttargetProxy = {I['proxyWidget']} /* PBXContainerItemProxy */;
\t\t}};
/* End PBXTargetDependency section */

/* Begin XCBuildConfiguration section */
{configs}/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
{lists}/* End XCConfigurationList section */
\t}};
\trootObject = {I['project']} /* Project object */;
}}
"""

SCHEME = """<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "2600" version = "1.7">
   <BuildAction parallelizeBuildables = "YES" buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting = "YES" buildForRunning = "YES" buildForProfiling = "YES" buildForArchiving = "YES" buildForAnalyzing = "YES">
            {ref}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv = "YES"></TestAction>
   <LaunchAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle = "0" useCustomWorkingDirectory = "NO" ignoresPersistentStateOnLaunch = "NO" debugDocumentVersioning = "YES" debugServiceExtension = "internal" allowLocationSimulation = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         {ref}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration = "Release" shouldUseLaunchSchemeArgsEnv = "YES" savedToolIdentifier = "" useCustomWorkingDirectory = "NO" debugDocumentVersioning = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         {ref}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration = "Debug"></AnalyzeAction>
   <ArchiveAction buildConfiguration = "Release" revealArchiveInOrganizer = "YES"></ArchiveAction>
</Scheme>
"""

base = os.path.join(root, PROJ)
os.makedirs(os.path.join(base, "project.xcworkspace/xcshareddata"), exist_ok=True)
os.makedirs(os.path.join(base, "xcshareddata/xcschemes"), exist_ok=True)
open(os.path.join(base, "project.pbxproj"), "w").write(pbx)
open(os.path.join(base, "project.xcworkspace/contents.xcworkspacedata"), "w").write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<Workspace\n   version = "1.0">\n   <FileRef\n      location = "self:">\n   </FileRef>\n</Workspace>\n')
for k, name, prod, *_ in TARGETS:
    if k == "widget":
        continue
    ref = (f'<BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "{I[k + "target"]}" BuildableName = "{prod}" '
           f'BlueprintName = "{name}" ReferencedContainer = "container:{PROJ}"></BuildableReference>')
    open(os.path.join(base, f"xcshareddata/xcschemes/{name}.xcscheme"), "w").write(SCHEME.format(ref=ref))
print("ok:", PROJ)
