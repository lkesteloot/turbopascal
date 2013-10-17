{$M 16384,0,655360 }
Program Amazing;

{$N+}

uses
  Crt, Graph;

const
  NumSunsetColors = 12;
  SunsetColor : Array[1..NumSunsetColors] of Integer =
        (Red,LightRed,Yellow,Red,LightRed,Magenta,LightMagenta,Magenta,LightMagenta,
         Red,Red,Red);
  NumC = 8;
  FallColors : Array[1..2,1..NumC] of Integer =
      ((Yellow,Brown,Yellow,Brown,Yellow,Brown,Yellow,Brown),
      (Red,Red,LightRed,Red,LightRed,Red,Brown,Brown));
  PinkColors : Array[0..1] of Integer = (Brown,Yellow);{Red,LightRed);}
  GreenColors : Array[0..1] of Integer = (Green,LightGreen);
  Night = False;
  Sunset = True;
  Mountain = False;
  MountainRange = True;
  Rose = True;
  CrescentMoon = True;
  DistantGrass = False;
  Caterpillar = True;
  Forest = False;
  Cloud = True;
  WriteText = True;

  Steps = 6;
  AR = 1.3;

var
  GraphDriver, GraphMode, ErrorCode : Integer;
  Ch : Char;
  R,DropY, DropYY, Limit, T : double;
  A,B,Radius,XX,YY,TT,C, CatY, Timer, DropX, MidX, MidY, J,I,K,X,Y : Integer;
  Cat, Drop : Pointer;
  S1,S2,S3,S4 : Integer;
  MountRange : Array[0..1000] of Integer;
  LowestY : Integer;

type
  Ptr = ^MidPointType;
  MidPointType = record
                doubleX : Integer;
                doubleY : Integer;
                NewX  : Integer;
                NewY  : Integer;
                Next  : Ptr;
              end;

var
  Range : Integer;
  P, Head : Ptr;

procedure PutDotInCircle (X,Y,R,C : Integer);

var
  XX, YY, RR : Integer;
  Theta : double;

begin
  Theta := Random * 2*Pi;
  RR := Random (R+1);
  XX := X+Round(Cos(Theta)*RR);
  YY := Y-Round(Sin(Theta)*RR/AR);
  If (XX >= 0) and (XX <= GetMaxX) and (YY >= 0) and (YY <= GetMaxY) then
    PutPixel (XX,YY,C);
end;

function CheckPoint (doubleX,doubleY: Integer; var NewX,NewY: Integer): Boolean;

var
  Done : Boolean;
  P, Q : Ptr;

begin
  Done := False;
  Q := Head;
  P := Head^.Next;
  While (P <> Nil) and (Not Done) do
      If (P^.doubleX = doubleX) and (P^.doubleY = doubleY) then
        begin
          NewX := P^.NewX;
          NewY := P^.NewY;
          Done := True;
          Q^.Next := P^.Next;
          Dispose (P);
        end
      else
        begin
          Q := P;
          P := P^.Next;
        end;
  CheckPoint := Done;
end;

procedure StorePoint (doubleX, doubleY, NewX, NewY: Integer);

var
  Q : Ptr;

begin
  New (Q);
  Q^.doubleX := doubleX;
  Q^.doubleY := doubleY;
  Q^.NewX  := NewX;
  Q^.NewY  := NewY;
  Q^.Next  := Head^.Next;
  Head^.Next := Q;
end;

procedure Triangle (X1,Y1,X2,Y2,X3,Y3,Count: Integer);

type
  PolyType = Array[1..3] of PointType;

var
  MidX1, MidY1,
  MidX2, MidY2,
  MidX3, MidY3 : Integer;
  Plotted1, Plotted2, Plotted3 : Boolean;
  TriangleData : PolyType;
  Color : Integer;

begin
  If Count = 0 then Exit;
  If Count = 1 then
    begin
      SetColor (GetMaxColor);
      TriangleData[1].X := X1;
      TriangleData[1].Y := Y1;
      TriangleData[2].X := X2;
      TriangleData[2].Y := Y2;
      TriangleData[3].X := X3;
      TriangleData[3].Y := Y3;
      If (TriangleData[1].Y > GetMaxY div 3*2) or
         (TriangleData[2].Y > GetMaxY div 3*2) or
         (TriangleData[3].Y > GetMaxY div 3*2) then Color := 0 else Color := 1;
{      SetFillStyle (SolidFill, Color);}
      If Color = 0 then
        begin
          SetFillStyle (SolidFill, Brown);
          SetColor (Green);
        end
      else
        begin
          SetFillStyle (SolidFill, White);
          SetColor (LightGray);
        end;
      FillPoly (3,TriangleData);
    end;

  If Steps - Count > 10 then
    begin
      MidX1 := (X1 + X2) div 2;
      MidY1 := (Y1 + Y2) div 2;
      MidX2 := (X2 + X3) div 2;
      MidY2 := (Y2 + Y3) div 2;
      MidX3 := (X3 + X1) div 2;
      MidY3 := (Y3 + Y1) div 2;
    end
  else
    begin
      Plotted1 := CheckPoint ((X1 + X2) div 2,(Y1 + Y2) div 2,MidX1,MidY1);
      Plotted2 := CheckPoint ((X2 + X3) div 2,(Y2 + Y3) div 2,MidX2,MidY2);
      Plotted3 := CheckPoint ((X3 + X1) div 2,(Y3 + Y1) div 2,MidX3,MidY3);
      Range := Abs ((X1 - X2)*(X1 - X2) + (Y1 - Y2)*(Y1 - Y2)) div 350;
      If Range < 3 then Range := 3;
      If Not Plotted1 then
        begin
          MidX1 := (X1 + X2) div 2 + (Random (Range)-(Range - 1) div 2);
          MidY1 := (Y1 + Y2) div 2 + (Random (Range)-(Range - 1) div 2);
          StorePoint ((X1 + X2) div 2,(Y1 + Y2) div 2,MidX1,MidY1);
        end;
      If Not Plotted2 then
        begin
          MidX2 := (X2 + X3) div 2 + (Random (Range)-(Range - 1) div 2);
          MidY2 := (Y2 + Y3) div 2 + (Random (Range)-(Range - 1) div 2);
          StorePoint ((X2 + X3) div 2,(Y2 + Y3) div 2,MidX2,MidY2);
        end;
      If Not Plotted3 then
        begin
          MidX3 := (X3 + X1) div 2 + (Random (Range)-(Range - 1) div 2);
          MidY3 := (Y3 + Y1) div 2 + (Random (Range)-(Range - 1) div 2);
          StorePoint ((X3 + X1) div 2,(Y3 + Y1) div 2,MidX3,MidY3);
        end;
    end;

  If Keypressed then Halt;
  Triangle (MidX1,MidY1,MidX2,MidY2,MidX3,MidY3,Count - 1);
  Triangle (   X1,   Y1,MidX1,MidY1,MidX3,MidY3,Count - 1);
  Triangle (   X2,   Y2,MidX1,MidY1,MidX2,MidY2,Count - 1);
  Triangle (   X3,   Y3,MidX2,MidY2,MidX3,MidY3,Count - 1);
end;


procedure ShootingStar;

var
  X,Y,XX,YY : double;
  T : Integer;
  OX, OY, C : Array[0..200] of Integer;

begin
  X := GetMaxX - 20;
  Y := 20;
  XX := -10;
  YY := 2;
  For T := 1 to 150 do
    begin
      If T <= 100 then
        begin
          OX[T] := Round(X);
          OY[T] := Round(Y);
          C[T] := GetPixel (OX[T],OY[T]);
          If (OX[T] = OX[T-1]) and (OY[T] = OY[T-1]) then C[T] := C[T-1];
          PutPixel (Round(X),Round(Y),White);
          X := X + XX;
          Y := Y + YY;
          XX := XX * 0.95;
          YY := YY * 0.95;
        end;
      Delay (3);
      If T > 50 then
        PutPixel (OX[T-50],OY[T-50],C[T-50]);
    end;
end;

  procedure DrawCloud (X,Y,L,LC,UC : Integer);

  begin
    If L > 0 then
      begin
        DrawCloud (X-Random(L div 7),Y+Random(L div 25),L div 4 * 3,LC,UC);
        DrawCloud (X+Random(L div 7),Y+Random(L div 25),L div 4 * 3,LC,UC);
      end
    else
      begin
        SetColor (LC);
        Line (X,Y,X+L,Y);
        SetColor (UC);
        Line (X,Y-1,X+L,Y-1);
        If Keypressed then Halt;
      end;
  end;


begin
  GraphDriver := Detect;
  InitGraph (GraphDriver, GraphMode, 'D:\TP4');
  ErrorCode := GraphResult;
  If ErrorCode <> grOk then Halt;

  New (P);   { Initialize the database }
  P^.Next := Nil;
  P^.doubleX := 9999;
  P^.doubleY := 9999;
  Head := P;

  If Not Night then
    SetBkColor (black);

  Rectangle (100,100,104,104);
  Rectangle (101,101,103,103);
  PutPixel (102,102,White);
  Line (101,99,103,99);
  PutPixel (102,98,White);
  PutPixel (100,104,Black);
  PutPixel (104,104,Black);
  PutPixel (100,100,Black);
  PutPixel (104,100,Black);
  GetMem (Drop,ImageSize (100,95,104,104));
  GetImage (100,95,104,104,Drop^);
  ClearDevice;
  SetColor (Brown);
  Circle (100,100,5);
  SetFillStyle (SolidFill,Brown);
  FloodFill (100,100,Brown);
  GetMem (Cat,ImageSize (95,95,105,105));
  GetImage (95,95,105,105,Cat^);
  ClearDevice;
  Randomize;

(**********************************************************************)
(************************** START OF DRAWING **************************)
(**********************************************************************)

  If MountainRange then  { Calculate Mountain Range }
    begin
      LowestY := 0;
      Y := GetMaxY - 80;
      For I := 0 to GetMaxX do
        begin
          MountRange[I] := Y;
          If LowestY < Y then LowestY := Y;
          Y := Y + Random(3)-1 ;
        end;
    end
  else
    LowestY := GetMaxY;

  If Night then
    begin
      SetColor (White);
      For I := 1 to 30 do
        begin
          X := Random (GetMaxX);
          Y := Random (GetMaxY);
          Line (X-1,Y-1,X+1,Y+1);
          Line (X-1,Y+1,X+1,Y-1);
        end;
      For I := 1 to 30 do
        PutPixel (Random(GetMaxX),Random(GetMaxY),White);
      For I := 1 to 5 do
        PutPixel (Random(GetMaxX),Random(GetMaxY),Yellow);
      For I := 1 to 5 do
        PutPixel (Random(GetMaxX),Random(GetMaxY),LightRed);
      For I := 1 to 5 do
        PutPixel (Random(GetMaxX),Random(GetMaxY),LightBlue);

      If CrescentMoon then
        begin
          SetFillStyle (SolidFill,White);
          Circle (100,50,20);
          FloodFill (100,50,White);
          SetColor (Black);
          SetFillStyle (SolidFill,Black);
          Circle (110,50,20);
          FloodFill (110,50,Black);
        end
      else
        begin
          For I := 1 to 100 do
            begin
              For J := 1 to 100-I do
                PutDotInCircle (100,50,I,LightGray);
              If Keypressed then Halt;
            end;
          SetColor (White);
          Circle (100,50,20);
          SetFillStyle (SolidFill,White);
          FloodFill (100,50,White);
{          For Q := 1 to 10000 do
            PutDotInCircle (GetMaxX div 2,GetMaxY div 2,100,LightGray);}
          If Keypressed then Halt;
{  For T := 1 to 100 do
    For Q := 1 to 30 do
      PutDotInCircle (GetMaxX div 2,GetMaxY div 2,T,White);
  For T := 1 to 40 do
    For Q := 1 to 20 do
      begin
        PutDotInCircle (GetMaxX div 2 - 40,GetMaxY div 2 - 30,T,LightGray);
        PutDotInCircle (GetMaxX div 2 + 40,GetMaxY div 2 - 40,T,LightGray);
        PutDotInCircle (GetMaxX div 2,GetMaxY div 2 + 30,T,LightGray);
      end;}
        end;
    end
  else
    begin
      SetBkColor (Blue);
      SetFillStyle (SolidFill,blue);
      FloodFill (1,1,blue);
      For I := 0 to GetMaxY do
        begin
          If Keypressed then Halt;
          For K := 1 to I do
            PutPixel (Random(GetMaxX),Random(GetMaxY-I)+I,LightBlue);
        end;
      If Sunset then    { SUNSET }
        begin
          For I := 0 to LowestY do
            begin
              If Keypressed then Halt;
              For K := 1 to I*2 do
                PutPixel (Random(GetMaxX),Random(LowestY-I)+I,
                          SunsetColor[Random(NumSunsetColors)+1]);
            end;
          If Not MountainRange then MountRange[GetMaxX div 2] := GetMaxY - 10;
          For J := 1 to 1000 do  { Sun in Sunset }
            For I := 1 to 20 do
              PutDotInCircle (GetMaxX div 2,MountRange[GetMaxX div 2]+5,J,yellow);
         end
      else
         For J := 1 to 1000 do  { Draw a Sun in upper-left hand corner }
          For I := 1 to 20 do
            PutDotInCircle (50,50,J,Yellow);
    end;

(******************************** Cloud *********************************)

  SetColor (White);
  If Cloud and Not Night then
    begin
      If Sunset then
        begin
          DrawCloud (GetMaxX div 5*4,GetMaxY div 3+3,400,LightRed,LightGray);
          DrawCloud (GetMaxX div 5*4,GetMaxY div 3,400,LightRed,LightGray);
          DrawCloud (GetMaxX div 4,GetMaxY div 2+3,300,LightRed,LightGray);
          DrawCloud (GetMaxX div 4,GetMaxY div 2,300,LightRed,LightGray);
        end
      else
        begin
          DrawCloud (GetMaxX div 5*4,GetMaxY div 3+3,400,LightGray,White);
          DrawCloud (GetMaxX div 5*4,GetMaxY div 3,400,LightGray,White);
          DrawCloud (GetMaxX div 4,GetMaxY div 2+3,300,LightGray,White);
          DrawCloud (GetMaxX div 4,GetMaxY div 2,300,LightGray,White);
        end;
    end;

(******************************* Mountain *******************************)

  If Mountain then
    Triangle (GetMaxX div 2,GetMaxY,
              GetMaxX div 4 * 3,GetMaxY div 2,
              GetMaxX,GetMaxY,Steps);

(**************************** Mountain Range ****************************)

  If MountainRange and (Not Night) and Sunset then
    begin
      SetColor (Black);
      For I := 0 to GetMaxX do
        Line (I,MountRange[I],I,GetMaxY);
    end;

(***************************** Distant Grass ****************************)

  If DistantGrass then
    begin
      For J := 0 to 10 do
        For I := 0 to GetMaxX do
          begin
            SetColor (Random(2)*8+Green);
            Line (I,                   GetMaxY-40+3*J,
                  I+Random(J)-J div 2, GetMaxY-40+3*J-Round(Sqrt(Random(J*J))));
            If Keypressed then Halt;
          end;
    end;

(*************************** Tee and Golf-Ball **************************)

  SetColor (Yellow);
  MidX := 100;
  MidY := GetMaxY - 30 - 23;
  For X := 1 to 20 do
    begin
      Line (100+X div 2,GetMaxY - 30 - Round(Ln(X/20)*20),
      100-X div 2,GetMaxY - 30 - Round(Ln(X/20)*20));
    end;
  SetColor(White);
  Circle (MidX,MidY,30);
  SetFillStyle(SolidFill,White);
  FloodFill(MidX,MidY,White);
  SetColor (LightGray);
  Circle (MidX,MidY,30);
  SetColor (DarkGray);
  Circle (MidX,MidY,31);

  SetColor(LightGray);
  SetFillStyle(SolidFill,LightGray);
  Y := 0;
  YY := 7;
  I := 1;
  Repeat
    T := 0;
    Repeat
      T := T + 2*Pi/(I*4);
      Radius := 1;
      If I < 5 then Radius := 2;
      If I < 2 then Radius := 3;
      A := MidX+Round(Cos(T)*Y);
      B := MidY+Round(Sin(T)*Y/AR);
      Circle (A,B,Radius);
      FloodFill (A,B,LightGray);
      If Radius = 3 then
        begin
          PutPixel (A-1,B+1,DarkGray);
          PutPixel (A-2,B+1,DarkGray);
          PutPixel (A-1,B+2,DarkGray);
          PutPixel (A,B+2,DarkGray);
          PutPixel (A-2,B,DarkGray);
          PutPixel (A-3,B,DarkGray);
          PutPixel (A-2,B-1,DarkGray);
          PutPixel (A-1,B,DarkGray);
          PutPixel (A,B+1,DarkGray);
          PutPixel (A+1,B+2,DarkGray);
        end;
      If Radius = 2 then
        begin
          PutPixel (A-1,B+1,DarkGray);
          PutPixel (A,B+1,DarkGray);
          PutPixel (A-1,B,DarkGray);
          PutPixel (A-2,B,DarkGray);
          PutPixel (A-1,B-1,DarkGray);
          PutPixel (A,B,DarkGray);
          PutPixel (A+1,B+1,DarkGray);
        end;
      If Radius = 1 then
        begin
          PutPixel (A-1,B,DarkGray);
          PutPixel (A,B+1,DarkGray);
        end;
      If Keypressed then Halt;
    Until T > 2*Pi;
    I := I + 1;
    Y := Y + YY;
    YY := YY - 1;
    If YY < 2 then YY := 2;
  Until Y > 30;

{  For X := -30 to 30 do
    For Y := -30 to 30 do
      begin
        C := GetPixel (MidX+X,MidY+Y);
        SetColor (C);
        SetFillStyle (SolidFill,C);
        Rectangle(GetMaxX div 2 + X*5,GetMaxY div 2 + Y*5,
                  GetMaxX div 2 + X*5+4,GetMaxY div 2 + Y*5+4);
        FloodFill(GetMaxX div 2 + X*5+1,GetMaxY div 2 + Y*5+1,C);
      end;}


(******************************* FOREST *******************************)

If Forest then
  begin
    For J := GetMaxX - 200 to GetMaxX do
      For X := 1 to 3 do
        PutDotInCircle (J,GetMaxY - 100,5,Brown);
    For J := 1 to 10 do
      begin
        X := Random(200)+GetMaxX-100;
        SetColor (Brown);
        TT := Random(2)+1;
        For K := -TT to TT do
          begin
            SetColor (Brown);
            If (TT = 2) and (K*K = 1) then SetColor (Black);
            If (TT = 1) and (K = 0) then SetColor (Black);
            Line (X + K,GetMaxY-100,X + K,GetMaxY-118+Random(4));
          end;
        C := Random(NumC)+1;
        Y := Random(10)+5;  { Height }
        I := Random(5)+1;
        If I > 2 then I := 2;
        For K := 1 to 250 do
          PutDotInCircle (X,GetMaxY-100+Y div 2,15,FallColors[I,Random(C)+1]);
        For K := 1 to 250 do
          PutDotInCircle (X,GetMaxY-100-Y div 2,15,FallColors[I,Random(C)+1]);
        If KeyPressed then Halt;
      end;
    end;

(******************************** ROSE ********************************)

  If Rose then
    begin
      SetColor (LightGreen);
      For I := -20 to 200 do
        For K := 1 to 5 do
          Circle (GetMaxX div 2 + 20 + I,GetMaxY div 2 + Round(Sqr(I/10)*2),K);

      K := 170;
      I := 16;
      If Odd(I) then
        Limit := Pi*2
      else
        Limit := 2*Pi;
      Repeat
          T := 0;
          Repeat
            R := 1+6*Sin(I*T);
            X := Round(K*Cos(T)*R*1.3/10);
            Y := Round(K*Sin(T)*R/10);
            If K < 50 then
              SetColor (GreenColors[K mod 2])
            else
              SetColor (PinkColors[K mod 2]);
            If T = 0 then
              MoveTo (GetMaxX div 2 + X,GetMaxY div 2 - Y)
            else
              LineTo (GetMaxX div 2 + X,GetMaxY div 2 - Y);
            T := T + 0.01;
            If Keypressed then Halt;
          Until T > Limit;
          K := K - 1;
      Until K < 2;

      SetLineStyle (SolidLn,SolidFill,ThickWidth);
      For I := 1 to 5 do
        begin
          SetColor (White);
          Line (GetMaxX div 2,GetMaxY div 2,
                GetMaxX div 2 + Round(Cos(Pi/6*I)*20),
                GetMaxY div 2 - Round(Sin(Pi/6*I)*20));
          SetColor (Brown);
          Circle (GetMaxX div 2 + Round(Cos(Pi/6*I)*20),
                  GetMaxY div 2 - Round(Sin(Pi/6*I)*20),3);
          Circle (GetMaxX div 2 + Round(Cos(Pi/6*I)*20),
                  GetMaxY div 2 - Round(Sin(Pi/6*I)*20),2);
          Circle (GetMaxX div 2 + Round(Cos(Pi/6*I)*20),
                  GetMaxY div 2 - Round(Sin(Pi/6*I)*20),1);
        end;
    end;

(****************************  GRASS  ************************************)

  SetLineStyle (SolidLn,SolidFill,NormWidth);
  SetColor (Green);

  For I := 0 to GetMaxX do
    begin
      If Not (Sunset or Night) then SetColor (GreenColors[I mod 2]);
      Line (I,GetMaxY,I+Random(20)-10,GetMaxY - Round(Sqrt(Random(900))));
    end;
  For I := 0 to GetMaxX do
    begin
      If Not (Sunset or Night) then SetColor (GreenColors[I mod 2]);
      Line (I,GetMaxY,I+Random(20)-10,GetMaxY - Round(Sqrt(Random(900))));
    end;

(*******************************  TEXT  ***********************************)

  If WriteText then
    begin
      SetTextStyle (GothicFont,HorizDir,4);
      SetTextJustify (CenterText,CenterText);
      SetColor (LightMagenta);
      OutTextXY (GetMaxX div 2,GetMaxY div 6 * 5,'Quest for the Golf Ball');
      SetColor (White);
      OutTextXY (GetMaxX div 2+1,GetMaxY div 6 * 5-2,'Quest for the Golf Ball');
      Delay (2000);
      SetColor (Black);
      OutTextXY (GetMaxX div 2,GetMaxY div 6 * 5,'Quest for the Golf Ball');
      SetColor (Black);
      OutTextXY (GetMaxX div 2+ 1,GetMaxY div 6 * 5-2,'Quest for the Golf Ball');
    end;

(****************************  CATEPILLAR  ********************************)

  If Caterpillar then
    begin
      CatY := 38;
      X := GetMaxX - 100;
      While X > 5 do
        begin
          If Random(50)=0 then ShootingStar;
          For I := 10 downto 1 do
            begin
              If X <> GetMaxX-100 then PutImage (X+3+I*8,GetMaxY - CatY,Cat^,XOrPut);
              If (I >= 2) and (I <= 9) then {  was: If I in [2..9] then }
                begin
                  PutImage (X+I*8,GetMaxY - CatY - 3,Cat^,XOrPut);
                  Delay (100);
                  PutImage (X+I*8,GetMaxY - CatY - 3,Cat^,XOrPut);
                end;
              PutImage (X+I*8,GetMaxY - CatY,Cat^,XOrPut);
            end;
          Delay (200);
          If Keypressed then Halt;
          X := X - 3;
        end;
    end;

(****************************  DROP  ************************************)

  DropX := 530;
  Repeat
  If Random(10)=0 then ShootingStar;
  Delay (3000);  { General pause between the drops }
  DropY := 120;
  DropYY := 0;
  Repeat
    begin
      PutImage (DropX,Round(DropY),Drop^,XOrPut);
      Delay (10);
      PutImage (DropX,Round(DropY),Drop^,XOrPut);
      DropY := DropY + DropYY;
      DropYY := DropYY + 0.1;
    end;
  Until DropY > GetMaxY;

  For X := -30 to 30 do
    begin
      Sound ((X+35)*500);
      S1 := GetPixel (DropX + 30 + X,GetMaxY - 36 + Round(Sqr(X/5)));
      S2 := GetPixel (DropX - 30 - X,GetMaxY - 36 + Round(Sqr(X/5)));
      S3 := GetPixel (DropX + 15 + X div 2,GetMaxY - 9 + Round(Sqr(X/10)));
      S4 := GetPixel (DropX - 15 - X div 2,GetMaxY - 9 + Round(Sqr(X/10)));
      PutPixel (DropX + 30 + X,GetMaxY - 36 + Round(Sqr(X/5)),White);
      PutPixel (DropX - 30 - X,GetMaxY - 36 + Round(Sqr(X/5)),White);
      PutPixel (DropX + 15 + X div 2,GetMaxY - 9 + Round(Sqr(X/10)),White);
      PutPixel (DropX - 15 - X div 2,GetMaxY - 9 + Round(Sqr(X/10)),White);
      Delay (3);
      PutPixel (DropX + 30 + X,GetMaxY - 36 + Round(Sqr(X/5)),S1);
      PutPixel (DropX - 30 - X,GetMaxY - 36 + Round(Sqr(X/5)),S2);
      PutPixel (DropX + 15 + X div 2,GetMaxY - 9 + Round(Sqr(X/10)),S3);
      PutPixel (DropX - 15 - X div 2,GetMaxY - 9 + Round(Sqr(X/10)),S4);
    end;
    NoSound;

  Until Keypressed;

  Ch := ReadKey;
  ClearDevice;
  CloseGraph;
end.








 This is the old rose;

      K := 170;
      I := 5;
      If Odd(I) then
        Limit := Pi
      else
        Limit := 2*Pi;
      Repeat
          T := 0;
          Repeat
            X := Round(K*Cos(T)*Sin(I*T)*1.3);
            Y := Round(K*Sin(T)*Sin(I*T));
            If K < 50 then
              SetColor (GreenColors[K mod 2])
            else
              SetColor (PinkColors[K mod 2]);
            If T = 0 then
              MoveTo (GetMaxX div 2 + X,GetMaxY div 2 - Y)
            else
              LineTo (GetMaxX div 2 + X,GetMaxY div 2 - Y);
            T := T + 0.01;
            If Keypressed then Halt;
          Until T > Limit;
          K := K - 1;
      Until K < 165;



begin
  Count := 0;
  Randomize;
  GraphDriver := Detect;
  InitGraph (GraphDriver, GraphMode, '..');
  ErrorCode := GraphResult;
  If ErrorCode <> grOk then
    begin
      Writeln ('Graphics Error: ',GraphErrorMsg(ErrorCode));
      Halt;
    end;
  SetColor (GetMaxColor);
  Ch := ReadKey;
  ClearDevice;
  CloseGraph;
  ClrScr;
  Writeln (Count);
end.
