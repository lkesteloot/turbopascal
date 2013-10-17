program FireWorks;

{$R+}

uses
  Crt, Graph;

var
  GraphDriver, GraphMode, ErrorCode : Integer;
  Ch : Char;
  I, J, K, XStart, YStart : Integer;
  XX,YY,CC : Array[1..1000] of Integer;
  FX,FY,DX,DY : Array[1..70] of Real;
  R, T, X, Y : Real;

procedure Explode (C : Integer);

begin
  T := -Pi;
  I := 0;
  Repeat
    I := I + 1;
    DX[I] := Sin(T)*5;
    DY[I] := Cos(T)*5;
    FX[I] := X;
    FY[I] := Y;
    T := T + 0.15;
  Until T > Pi;

  K := 0;
  Repeat
    For J := 1 to I do
      begin
        If C = 0 then
          PutPixel (Round(FX[J]),Round(FY[J]),0)
        else
          PutPixel (Round(FX[J]),Round(FY[J]),Random(GetMaxColor+1));
        FX[J] := FX[J] + DX[J];
        FY[J] := FY[J] - DY[J];
        DY[J] := DY[J] - 0.2;
      end;
    K := K + 1;
    Delay(10); { This was not in the original. }
  Until Keypressed or (K > 50);
end;

procedure ShootFireWork;

begin
  { Delay (1000); }
  Randomize;
  T := Random / 2 - 0.25 + Pi/2;
  X := XStart;
  Y := YStart;
  R := 20;
  I := 0;
  Repeat
    Inc (I);
    XX[I] := Round(X);
    YY[I] := Round(Y);
    CC[I] := GetPixel (XX[I],YY[I]);
    If I > 1 then
      If (XX[I] = XX[I-1]) and (YY[I] = YY[I-1]) then CC[I] := CC[I-1];
    PutPixel (XX[I],YY[I],Random(GetMaxColor+1));
    If I > 5 then
      PutPixel (XX[I-5],YY[I-5],CC[I-5]);
    X := X + Cos(T)*R;
    Y := Y - Sin(T)*R;
    If T > Pi/2 then
      T := T + 0.02
    else
      T := T - 0.02;
    R := R * 0.93;
    Delay (20);
  Until KeyPressed or (T < 0) or (T > Pi);

  For J := I-5 to I do

     PutPixel (XX[J],YY[J],CC[J]);
{    ch := readkey; }
  Explode (1);
  Explode (0);
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
  XStart := GetMaxX div 2;
  YStart := GetMaxY - 20;

  Repeat
    ShootFireWork;
  Until Keypressed;

  Ch := ReadKey;
  ClearDevice;
  CloseGraph;
end.
