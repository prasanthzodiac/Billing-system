Set objShell = CreateObject("WScript.Shell")
appDir = "C:\Users\sarat\Music\billing system"

serverRunning = False
On Error Resume Next
Set objHttp = CreateObject("MSXML2.XMLHTTP")
objHttp.Open "GET", "http://127.0.0.1:3000/api/health", False
objHttp.Send
If objHttp.Status = 200 Then serverRunning = True
On Error Goto 0

If Not serverRunning Then
  objShell.Run "cmd /c cd /d """ & appDir & """ && npm run start", 0, False
  WScript.Sleep 4000
End If

objShell.Run "http://127.0.0.1:3000/", 1, False
