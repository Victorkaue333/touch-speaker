; Touch Speaker — opções do assistente do Windows (spec distribuicao-windows-macos FR-PKG-02…06, D8, D9;
; ADR-10). Incluído pelo NSIS do electron-builder (nsis.include). Arquivo em UTF-8 com BOM, para o NSIS
; ler os acentos.
;
; - FR-PKG-02: instala sempre só para o usuário atual, sem a página "para todos / só para mim" e sem UAC.
; - FR-PKG-03 (D8): atalho no Menu Iniciar sempre; na área de trabalho, opcional e marcado por padrão.
; - FR-PKG-04: "Iniciar o Touch Speaker com o Windows" grava o mesmo valor que o app lê e escreve por
;   app.getLoginItemSettings / setLoginItemSettings: em HKCU\...\Run, com o nome do AppUserModelId
;   (com.victoralves.touchspeaker, main/index.ts) e o caminho do executável entre aspas.
; - FR-PKG-06 (D9): desinstalar apaga esse valor; %APPDATA%\Touch Speaker fica (deleteAppDataOnUninstall: false).
; - Numa instalação por cima, as opções começam como estão hoje (atalho existe? valor existe?) e o
;   desinstalador antigo, chamado com --updated, não apaga o início automático (FR-PKG-07).

!define TS_RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define TS_RUN_VALUE "com.victoralves.touchspeaker"

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  !include LogicLib.nsh

  Var tsDesktopBox
  Var tsLoginBox
  ; "" = a página não foi mostrada (instalação silenciosa): nada muda além do padrão do electron-builder.
  Var tsDesktopChoice
  Var tsLoginChoice

  ; The page functions live inside the macro: it is inserted after MUI2 is loaded (assistedInstaller.nsh),
  ; and MUI_HEADER_TEXT does not exist yet where this file is included.
  !macro customPageAfterChangeDir
    Page custom tsOptionsPageCreate tsOptionsPageLeave

  Function tsOptionsPageCreate
    !insertmacro MUI_HEADER_TEXT "Opções" "Escolha como o Touch Speaker se instala."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 12u "Criar atalho na área de trabalho"
    Pop $tsDesktopBox
    ${NSD_CreateCheckbox} 0 18u 100% 12u "Iniciar o Touch Speaker com o Windows"
    Pop $tsLoginBox
    ${NSD_CreateLabel} 0 44u 100% 24u "Instala só para você, em %LOCALAPPDATA%; não pede administrador."
    Pop $0

    ; Primeira instalação: atalho marcado, início automático desmarcado. Por cima: o estado de hoje.
    ${If} ${isUpdated}
      ${If} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}.lnk"
        ${NSD_Check} $tsDesktopBox
      ${EndIf}
    ${Else}
      ${NSD_Check} $tsDesktopBox
    ${EndIf}
    ReadRegStr $1 HKCU "${TS_RUN_KEY}" "${TS_RUN_VALUE}"
    ${If} $1 != ""
      ${NSD_Check} $tsLoginBox
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function tsOptionsPageLeave
    ${NSD_GetState} $tsDesktopBox $tsDesktopChoice
    ${NSD_GetState} $tsLoginBox $tsLoginChoice
  FunctionEnd
  !macroend

  !macro customInstall
    ${If} $tsDesktopChoice == ${BST_UNCHECKED}
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
    ${EndIf}
    ${If} $tsLoginChoice == ${BST_CHECKED}
      WriteRegStr HKCU "${TS_RUN_KEY}" "${TS_RUN_VALUE}" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
    ${ElseIf} $tsLoginChoice == ${BST_UNCHECKED}
      DeleteRegValue HKCU "${TS_RUN_KEY}" "${TS_RUN_VALUE}"
    ${EndIf}
  !macroend
!endif

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "${TS_RUN_KEY}" "${TS_RUN_VALUE}"
  ${endIf}
!macroend
