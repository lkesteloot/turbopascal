program FastMandel;

{ Uses FF's enhanced block method to do the mandelbrot or julia set }
{ 8/16/90 - LK }

{ The following checks are turned off for speed: }

{$R-}  { Range checking off - Default }
{$S-}  { Stack checking off }
{$I-}  { I/O checking off }
{$F-}  { Far calls off - Default }
{$N+}  { Numeric Co-Processor }
{$E+}  { Emulation on if no math processor }

uses
  Crt, Graph;

const
  IsMandel = True;
  AA = 0.0;
  BB = -1.0;
  X1 = -2.0;
  X2 = 2.0;
  Y1 = -2.0;
  Y2 = 2.0;
  MaxCount = 25;
  BlockSize = 65;

var
  MaxX, MaxY, GraphDriver, GraphMode, ErrorCode : Integer;
  Ch : Char;
  A : Array[1..BlockSize,1..BlockSize] of ShortInt;

Procedure PutAPixel (X,Y,C : Integer);

begin
  PutPixel (X,Y,C);
  If IsMandel and (Y1+Y2=0) then PutPixel (X,MaxY-Y,C);
  If Not IsMandel and (Y1+Y2=0) and (X1+X2=0) then PutPixel (MaxX-X,MaxY-Y,C);
end;

Procedure PutABox (A1,B1,A2,B2,C : Integer);

begin
  SetFillStyle (SolidFill,C);
  Bar (A1,B1,A2,B2);
  If IsMandel and (Y1+Y2=0) then Bar(A1,MaxY-B1,A2,MaxY-B2);
  If Not IsMandel and (X1+X2=0) and (Y1+Y2=0) then Bar(MaxX-A1,MaxY-B1,MaxX-A2,MaxY-B2);
end;

Function GetMandel (SX,SY : Integer) : Integer;

var
  XY,XX,YY,A,B,X,Y,OldX : Real;
  Count : Integer;

begin
  Count := 1;
  If IsMandel then
    begin
      X := 0;
      Y := 0;
      A := X1 + SX/MaxX*(X2-X1);
      B := Y1 + SY/MaxY*(Y2-Y1);
    end
  else
    begin
      X := X1 + SX/MaxX*(X2-X1);
      Y := Y1 + SY/MaxY*(Y2-Y1);
      A := AA;
      B := BB;
    end;
  Repeat
    XX := X*X;
    YY := Y*Y;
    XY := X*Y;
    X := XX - YY + A;
    Y := XY+XY + B;
    Inc (Count);
  Until (XX+YY > 4.0) or (Count > MaxCount);
  If Count > MaxCount then
    GetMandel := 15
  else
    GetMandel := count mod 15 + 1;  {Count mod (GetMaxColor + 1);}
end;

procedure DoSmallBlock (SX,SY,AX,AY,Size : Integer);

var
  X,Y,Color : Integer;

begin
  If Size = 1 then
    begin
      If A[AX,AY] = -1 then A[AX,AY] := GetMandel (SX+AX-1,SY+AY-1);
      PutAPixel (SX+AX-1,SY+AY-1,A[AX,AY]);
      If A[AX+1,AY] = -1 then A[AX+1,AY] := GetMandel (SX+AX,SY+AY-1);
      PutAPixel (SX+AX,SY+AY-1,A[AX+1,AY]);
      If A[AX,AY+1] = -1 then A[AX,AY+1] := GetMandel (SX+AX-1,SY+AY);
      PutAPixel (SX+AX-1,SY+AY,A[AX,AY+1]);
      If A[AX+1,AY+1] = -1 then A[AX+1,AY+1] := GetMandel (SX+AX,SY+AY);
      PutAPixel (SX+AX,SY+AY,A[AX+1,AY+1]);
      Exit;
    end;
  Color := -1;
  For X := AX to AX+Size do
    begin
      If A[X,AY]=-1 then A[X,AY] := GetMandel(SX+X-1,SY+AY-1);
      If Color = -1 then Color := A[X,AY];
      If Color <> A[X,AY] then Color := -2;
      If A[X,AY+Size]=-1 then A[X,AY+Size] := GetMandel(SX+X-1,SY+AY-1+Size);
      If Color <> A[X,AY+Size] then Color := -2;
    end;
  For Y := AY to AY+Size do
    begin
      If A[AX,Y]=-1 then A[AX,Y] := GetMandel(SX+AX-1,SY+Y-1);
      If Color = -1 then Color := A[AX,Y];
      If Color <> A[AX,Y] then Color := -2;
      If A[AX+Size,Y]=-1 then A[AX+Size,Y] := GetMandel(SX+AX-1+Size,SY+Y-1);
      If Color <> A[AX+Size,Y] then Color := -2;
    end;
  If Color <> -2 then
    PutABox(SX+AX-1,SY+AY-1,SX+AX-1+Size,SY+AY-1+Size,Color)
  else
    begin
      DoSmallBlock (SX,SY,AX,AY,Size div 2);
      DoSmallBlock (SX,SY,AX+Size div 2,AY,Size div 2);
      DoSmallBlock (SX,SY,AX,AY+Size div 2,Size div 2);
      DoSmallBlock (SX,SY,AX+Size div 2,AY+Size div 2,Size div 2);
    end;
  If Keypressed then Halt;
end;

procedure DoBlock (SX,SY : Integer);

var i, j : integer;

begin
  { Fill it full of -1 }
  for i := 1 to BlockSize do
    for j := 1 to BlockSize do
        A[i,j] := -1;
  DoSmallBlock (SX*BlockSize,SY*BlockSize,1,1,BlockSize-1);
end;

procedure DrawTheStuff;

var
  D,X,Y : Integer;

begin
  D := 1;
  If IsMandel and (Y1+Y2=0) then D := 2;
  If Not IsMandel and (X1+X2=0) and (Y1+Y2=0) then D := 2;
  MaxX := GetMaxX div 1;
  MaxY := GetMaxY div 1;
  For X := 0 to MaxX div BlockSize do
    For Y := 0 to MaxY div D div BlockSize do
      begin
        DoBlock(X,Y);
        If Keypressed then Halt;
      end;
end;

begin
  GraphDriver := Detect;
  InitGraph (GraphDriver, GraphMode, '..');
  ErrorCode := GraphResult;
  If ErrorCode <> grOk then
    begin
      Writeln ('Graphics Error: ',GraphErrorMsg(ErrorCode));
      Halt;
    end;
  SetColor (GetMaxColor);
  DrawTheStuff;
  Ch := ReadKey;
  ClearDevice;
  CloseGraph;
end.
