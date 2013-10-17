{$M 65084,0,655360 }
Program Spider;

{$N+}

{ Draws some beeeyoootiful 3-d graphics of a spider on a chessboard }

uses
  Dos, Crt, Graph, Printer, Mouse;

const
  MaxPoly = 500; { Can go up to 650 }
  DiskMaxPoly = 5000;
  D : Integer = 1200;  { 300 }
  AR = 1.3;
  TempDrive = 'E';

  BackgroundColorDuring2dDrawing = Blue;
  ForegroundColorDuring2dDrawing = White;
  BackgroundColorDuring3dDrawing = Blue;
  ForegroundColorDuring3dDrawing = yellow;
  ColorForPolygonsDuringHidden = Green;

type
  LineType = Record
               X, Y, Z : Real;
             end;
  FootType = Record
               X, Y, Z : Real;
             end;

var
  Ch : Char;
  Z, A, B, Button, TT,X, T : Integer;
  dX, dZ, CenterX, CenterZ, R : Real;
  GraphDriver, GraphMode, GraphError : Integer;
  P : Array[1..4] of PointType;
  Sp : Array[1..6] of FootType;

Function Get3dX (X, Z : Real) : LongInt;

begin
  Get3dX := (GetMaxX div 2)-Trunc(D*X/Z*AR);
end;

Function Get3dY (Y, Z : Real) : LongInt;

begin
  Get3dY := (GetMaxY div 2)+Trunc(D*Y/Z);
end;

procedure Line3d (x1,y1,z1,x2,y2,z2 : Real);

begin
  Line (Get3dX(x1,z1),Get3dY(y1,z1),Get3dX(x2,z2),Get3dY(y2,z2));
end;

procedure FindCenter;

var
  T : Integer;

begin
  CenterX := 0;
  CenterZ := 0;
  For T := 1 to 6 do
    begin
      CenterX := CenterX + Sp[T].X;
      CenterZ := CenterZ + Sp[T].Z;
    end;
  CenterX := CenterX / 6;
  CenterZ := CenterZ / 6;
end;

procedure DrawBoard;

begin
  For X := -6 to 6 do
    Line3d (X,-2,-18,X,-2,-90);
  For Z := -3 downto -15 do
    Line3d (-6,-2,Z*6,6,-2,Z*6);
  For X := -6 to 5 do
    For Z := -3 downto -14 do
      begin
        If Odd (X+Z) then
          begin
            SetFillStyle (SolidFill,LightCyan);
            SetColor (LightCyan);
          end
        else
          begin
            SetFillStyle (SolidFill,Cyan);
            SetColor (Cyan);
          end;
        P[1].X := Get3dX (X,Z*6);
        P[1].Y := Get3dY (-2,Z*6);
        P[2].X := Get3dX (X,(Z-1)*6);
        P[2].Y := Get3dY (-2,(Z-1)*6);
        P[3].X := Get3dX (X+1,(Z-1)*6);
        P[3].Y := Get3dY (-2,(Z-1)*6);
        P[4].X := Get3dX (X+1,Z*6);
        P[4].Y := Get3dY (-2,Z*6);
        FillPoly (4,P);
      end;
{      else
        LineTo (Get3dX(Cos(2*Pi*X/9)*T*0.5,-54+Sin(2*Pi*X/9)*T*3),
               Get3dY(-2,-54+Sin(2*Pi*X/9)*T*3));
  For X := 1 to 9 do
    Line3d (0,-2,-54,Cos(2*Pi*X/9)*0.5*17,-2,-54+Sin(2*Pi*X/9)*3*17);
  For T := 1 to 12 do
    For X := 1 to 9 do
      begin
        If ((X < 7) and Odd (X+T)) or ((X >= 7) and Not Odd (X+T)) then
          begin
            SetFillStyle (SolidFill,LightCyan);
            SetColor (LightCyan);
          end
        else
          begin
            SetFillStyle (SolidFill,Cyan);
            SetColor (Cyan);
          end;
      P[1].X := Get3dX(Cos(2*Pi*X/9)*T*0.5,-54+Sin(2*Pi*X/9)*T*3);
      P[1].Y := Get3dY(-2,-54+Sin(2*Pi*X/9)*T*3);
      P[2].X := Get3dX(Cos(2*Pi*(X+1)/9)*T*0.5,-54+Sin(2*Pi*(X+1)/9)*T*3);
      P[2].Y := Get3dY(-2,-54+Sin(2*Pi*(X+1)/9)*T*3);
      P[3].X := Get3dX(Cos(2*Pi*(X+1)/9)*(T+1)*0.5,-54+Sin(2*Pi*(X+1)/9)*(T+1)*3);
      P[3].Y := Get3dY(-2,-54+Sin(2*Pi*(X+1)/9)*(T+1)*3);
      P[4].X := Get3dX(Cos(2*Pi*X/9)*(T+1)*0.5,-54+Sin(2*Pi*X/9)*(T+1)*3);
      P[4].Y := Get3dY(-2,-54+Sin(2*Pi*X/9)*(T+1)*3);
      FillPoly (4,P);
    end;}
end;

procedure DrawSpider;

var
  MidX, MidZ : Real;
  T : Integer;

begin
  HideCursor;
  SetWriteMode (XOrPut);
{  SetLineStyle (SolidLn,0,ThickWidth);}
  For T := 1 to 6 do
    begin
      MidX := (CenterX + Sp[T].X) * 0.5;
      MidZ := (CenterZ + Sp[T].Z) * 0.5;
      SetColor (LightCyan);
      Line3d (CenterX+1.5,-2,CenterZ,MidX+3,-2,MidZ);
      Line3d (MidX+3,-2,MidZ,Sp[T].X+3*(Sp[T].Y+2),-2,Sp[T].Z);
    end;
  For T := 1 to 6 do
    begin
      MidX := (CenterX + Sp[T].X) * 0.5;
      MidZ := (CenterZ + Sp[T].Z) * 0.5;
      SetColor (LightRed);
      Line3d (CenterX,-1.5,CenterZ,MidX,-1,MidZ);
      Line3d (MidX,-1,MidZ,Sp[T].X,Sp[T].Y,Sp[T].Z);
    end;
  ShowCursor;
end;

begin
  GraphDriver := Detect;
  InitGraph (GraphDriver,GraphMode,'\TURBO');
  GraphError := GraphResult;
  If GraphError <> grOk then
    begin
      Writeln ('Error : ',GraphErrorMsg (GraphError));
      Halt;
    end;
  For T := 1 to 6 do
    begin
      Sp[T].X := -8+Cos(T/6*2*Pi+0.2)*0.8;
      Sp[T].Y := -2;
      Sp[T].Z := -54+Sin(T/6*2*Pi+0.2)*6;
    end;
  SetBorderLimits (0,0,GetMaxX,GetMaxY);
  ShowCursor;
  Repeat
    GetMouseStatus (A,B,Button);
    For T := 1 to 6 do
      For X := 0 to 3 do
        begin
          ClearDevice;
          DrawBoard;
          FindCenter;
          DrawSpider;
    {      Delay (500);}
          { DrawSpider; }
          If T > 3 then
            TT := (T-3)*2
          else
            TT := T*2-1;
          dX := (A - GetMaxX div 2) / (GetMaxX div 2) * 0.4;
          dZ := (B - GetMaxY div 2) / (GetMaxY div 2) * 1.2;
          Sp[TT].X := Sp[TT].X + dX;
          If X < 3 then
            Sp[TT].Y := -1.8
          else
            Sp[TT].Y := -2;
          Sp[TT].Z := Sp[TT].Z + dZ;
        end;
  Until Keypressed or (Button > 0);
  While Keypressed do Ch := ReadKey;
end.
