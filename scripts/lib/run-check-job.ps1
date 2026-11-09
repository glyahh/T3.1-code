$ErrorActionPreference = 'Stop'
$invocation = Get-Content -LiteralPath $env:T3CODE_CHECK_CHANGED_INVOCATION_FILE -Raw -Encoding UTF8 | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Text;
using System.Runtime.InteropServices;
public static class T3CheckJob {
  [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
    public long ProcessTime, JobTime;
    public uint Flags;
    public UIntPtr MinWorkingSet, MaxWorkingSet;
    public uint ActiveProcesses;
    public UIntPtr Affinity;
    public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct IoCounters {
    public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
    public BasicLimits Basic;
    public IoCounters Io;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, int bytes);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [StructLayout(LayoutKind.Sequential)] struct StartupInfo {
    public uint Size;
    public IntPtr Reserved, Desktop, Title;
    public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
    public ushort Show, ReservedBytes;
    public IntPtr ReservedData, Input, Output, Error;
  }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
    public IntPtr Process, Thread;
    public uint ProcessId, ThreadId;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes,
    IntPtr threadAttributes, bool inherit, uint flags, IntPtr environment, string directory,
    ref StartupInfo startup, out ProcessInfo process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int kind);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool DuplicateHandle(IntPtr sourceProcess,
    IntPtr source, IntPtr targetProcess, out IntPtr target, uint access, bool inherit, uint options);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
  static IntPtr StandardHandle(int kind) {
    IntPtr duplicate;
    if (!DuplicateHandle(GetCurrentProcess(), GetStdHandle(kind), GetCurrentProcess(), out duplicate, 0, true, 2))
      throw new Win32Exception(Marshal.GetLastWin32Error());
    return duplicate;
  }
  public static int Run(string node, string launcher, string invocation) {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    var process = new ProcessInfo();
    var startup = new StartupInfo();
    bool started = false;
    try {
      if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      var limits = new ExtendedLimits();
      limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
      if (!SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(limits)))
        throw new Win32Exception(Marshal.GetLastWin32Error());
      startup.Size = (uint)Marshal.SizeOf(startup);
      startup.Flags = 0x100; // STARTF_USESTDHANDLES
      startup.Input = StandardHandle(-10);
      startup.Output = StandardHandle(-11);
      startup.Error = StandardHandle(-12);
      var command = new StringBuilder("\"" + node + "\" \"" + launcher + "\" \"" + invocation + "\"");
      if (!CreateProcess(node, command, IntPtr.Zero, IntPtr.Zero, true, 0x08000004, IntPtr.Zero, null, ref startup, out process))
        throw new Win32Exception(Marshal.GetLastWin32Error());
      // Assign the suspended child before it can create any descendants.
      if (!AssignProcessToJobObject(job, process.Process))
        throw new Win32Exception(Marshal.GetLastWin32Error());
      if (ResumeThread(process.Thread) == 0xffffffff)
        throw new Win32Exception(Marshal.GetLastWin32Error());
      started = true;
      if (WaitForSingleObject(process.Process, 0xffffffff) != 0)
        throw new Win32Exception(Marshal.GetLastWin32Error());
      uint code;
      if (!GetExitCodeProcess(process.Process, out code))
        throw new Win32Exception(Marshal.GetLastWin32Error());
      return unchecked((int)code);
    } finally {
      if (!started && process.Process != IntPtr.Zero) TerminateProcess(process.Process, 1);
      if (job != IntPtr.Zero) CloseHandle(job);
      if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
      if (process.Process != IntPtr.Zero) CloseHandle(process.Process);
      if (startup.Input != IntPtr.Zero) CloseHandle(startup.Input);
      if (startup.Output != IntPtr.Zero) CloseHandle(startup.Output);
      if (startup.Error != IntPtr.Zero) CloseHandle(startup.Error);
    }
  }
}
'@
exit [T3CheckJob]::Run($invocation.node, $invocation.launcher, $env:T3CODE_CHECK_CHANGED_INVOCATION_FILE)
