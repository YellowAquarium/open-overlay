' Open Overlay - start the proxy together with Subway Builder (Windows).
'
' Two ways to use this file:
'   1. Steam (recommended): Subway Builder > Properties > Launch Options:
'        wscript "C:\full\path\to\open-overlay\start-with-game.vbs" %command%
'      Then just play from Steam. The proxy starts invisibly and stops when the game closes.
'   2. Double-click it (or a desktop shortcut to it): starts the proxy and then the game.
'
' No console window is shown. The proxy writes its log to logs\proxy.log.

Option Explicit
Dim shell, fso, dir, proxy, i, arg, gameCommand, nodeOk

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
proxy = """" & dir & "\proxy.js"""

nodeOk = (shell.Run("cmd /c where node >nul 2>nul", 0, True) = 0)

If WScript.Arguments.Count > 0 Then
  ' Started by Steam with %command%: start the proxy, then run the game.
  gameCommand = ""
  For i = 0 To WScript.Arguments.Count - 1
    arg = WScript.Arguments(i)
    If InStr(arg, " ") > 0 And Left(arg, 1) <> """" Then arg = """" & arg & """"
    gameCommand = gameCommand & arg & " "
  Next
  ' Start the proxy first (hidden). It watches for the Subway Builder process and stops when it is gone.
  If nodeOk Then
    shell.Run "node " & proxy & " --with-game", 0, False
  Else
    MsgBox "Node.js was not found, so the Open Overlay proxy could not start." & vbCrLf & _
      "Install Node.js from https://nodejs.org/ - the game will still run without the overlay.", 48, "Open Overlay"
  End If
  ' Run the game and wait (invisibly) until it exits, so Steam still sees it as running.
  ' Do NOT use shell.Exec here: Exec connects the game's console output to a pipe nobody reads,
  ' and once that pipe fills up the game freezes on a grey screen.
  shell.Run Trim(gameCommand), 1, True
Else
  If Not nodeOk Then
    MsgBox "Node.js was not found. Install it from https://nodejs.org/ and try again.", 48, "Open Overlay"
    WScript.Quit 1
  End If
  ' Double-clicked: start the proxy, which launches the game and stops after it closes.
  shell.Run "node " & proxy & " --with-game --launch-game", 0, False
End If
