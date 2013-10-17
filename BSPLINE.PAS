program BSplineCurve;

{$N+}
uses
  Crt, Graph;

const
  NumDots = 5;

type
  xyzArray = Array[0..100,1..3] of LongInt;

var
  N,K,GraphDriver, GraphMode, ErrorCode : Integer;
  Ch : Char;
  knotK, knotN : Integer;

  function Knot (I : Integer) : Integer;

  begin
    If I < knotK then
      Knot := 0
    else
      If I > knotN then Knot := knotN - knotK + 2
    else
      Knot := i - knotK + 1;
  end;

  function NBlend (I,K : Integer; U : Real) : Real;

  var
    T : Integer;
    V : Real;

  begin
    If K <= 1 then
      begin
        V := 0;
        If (Knot(I) <= U) and (U < Knot(I+1)) then V := 1;
      end
    else
      begin
        V := 0;
        T := Knot(I+K-1)-Knot(I);
        If T <> 0 then V := (u-Knot(i))*NBlend(i,K-1,u)/t;
        t := knot(i+K) - knot(i+1);
        If T <> 0 then
          V := V + (Knot(I+K)-U)*NBlend(I+1,K-1,U)/t;
      end;
    NBlend := V;
  end;

  procedure BSpline (var X,Y,Z : Real; U : Real; N,K : Integer; P : xyzArray);

  var
    I : integer;
    B : Real;

  begin

    KnotK := K;
    KnotN := N;
    X := 0;
    Y := 0;
    Z := 0;
    For I := 0 to N do
      begin
        B := NBlend(I,K,U);
        X := X + p[I,1]*B;
        Y := Y + p[I,2]*B;
      end;
  end;

  procedure DrawCurve;

  var
    ControlPoints : xyzArray;
    I : LongInt;
    X, Y, Z : Real;

  begin
    For I := 0 to 30 do
      ControlPoints[I,3] := 0;
    For I := 0 to NumDots-1 do
      begin
        ControlPoints[I,1] := Random(GetMaxX);
        ControlPoints[I,2] := Random(GetMaxY);
      end;
    SetColor (LightCyan);
    SetLineStyle (UserBitLn,1,NormWidth);
    For I := 0 to NumDots-1 do
      If I = 0 then
        MoveTo (ControlPoints[I,1],ControlPoints[I,2])
      else
        LineTo (ControlPoints[I,1],ControlPoints[I,2]);
    SetLineStyle (SolidLn,0,NormWidth);
    SetColor (Yellow);
    N := NumDots-1;
    K := 3;

        SetColor (K+8);
        For I := 0 to 2300 do
          begin
            BSpline(X,Y,Z,I/2301*(N-K+2),N,K,ControlPoints);
            If I = 0 then
              MoveTo (Round(X),Round(Y))
            else
              LineTo (Round(X),Round(Y));
            If Keypressed then Halt;
          end;

  end;

begin
  GraphDriver := Detect;
  InitGraph (GraphDriver, GraphMode, '..');
  ErrorCode := GraphResult;
  If ErrorCode <> grOk then Halt;
  SetColor (GetMaxColor);
  Randomize;
  DrawCurve;
  Ch := ReadKey;
  ClearDevice;
  CloseGraph;
end.
